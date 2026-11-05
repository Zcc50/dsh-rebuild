/**
 * Host half of the todo-list bundle.
 *
 * Owns the durable side of 「抱怨先生的待办列表」 once it lives inside DSH:
 *   - the same `tasks.json` the Electron build used, resolved through its
 *     config.json (data directory + backup volume), so both apps read one store;
 *   - the browser API the panel talks to, `/todo-list/api/*`, because a plain-JS
 *     Client half cannot call arbitrary Host services;
 *   - an agent-facing surface (`todo_list`, `todo_add`, `todo_update`) that is
 *     deliberately separate from `task_list` / `task_write`;
 *   - backups, export and the launch diff, carried over from electron/main.cjs.
 *
 * Task-pure logic lives in `lib/task-store.js` (a copy of the Electron app's
 * `src/core/task-store.js`); this file only adds I/O, routing and the tools.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  createTask,
  deriveStatus,
  insertTask,
  migrateTasks,
  patchList,
  refreshRecurring,
  removeSubtree,
  setStatus,
} from './lib/task-store.js';

export const name = 'todo-list';
export const inject = ['tools'];

const ROUTE_PREFIX = '/todo-list/api';
const APP_FOLDER = 'mr-baoyuan-todo';
const TODO_FOLDER = 'TODO';
const BACKUP_KEEP = 10;
const DRIVE_LETTERS = 'CDEFGHIJKLMNOPQRSTUVWXYZ';
const DEFAULT_AUTO = { start: false, exit: false, every: 0 };

function message(error) {
  return error && error.message ? String(error.message) : String(error);
}

function warn(ctx, text) {
  try {
    const logger = typeof ctx.logger === 'function' ? ctx.logger('todo-list') : undefined;
    if (logger && typeof logger.warn === 'function') logger.warn(text);
  } catch {
    /* logging never breaks a request */
  }
}

// ---------------------------------------------------------------------------
// directories and config (mirrors electron/main.cjs)
// ---------------------------------------------------------------------------

function appDataRoot() {
  if (process.env.APPDATA) return process.env.APPDATA;
  if (process.platform === 'win32') return path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(os.homedir(), '.config');
}

function userDataDir() {
  return path.join(appDataRoot(), APP_FOLDER);
}

function withTodoFolder(dirPath) {
  if (!dirPath) return dirPath;
  const resolved = path.resolve(dirPath);
  if (path.basename(resolved).toLowerCase() === TODO_FOLDER.toLowerCase()) return resolved;
  return path.join(resolved, TODO_FOLDER);
}

function loadConfig() {
  const file = path.join(userDataDir(), 'config.json');
  const fallback = {
    dataDir: null,
    backupDir: null,
    backupVolume: null,
    autoBackup: { ...DEFAULT_AUTO },
    autoStart: { enabled: false },
  };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      ...fallback,
      ...parsed,
      autoBackup: { ...DEFAULT_AUTO, ...(parsed && parsed.autoBackup) },
    };
  } catch {
    return fallback;
  }
}

function saveConfig(patch) {
  const file = path.join(userDataDir(), 'config.json');
  const next = { ...loadConfig(), ...patch };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  } catch (error) {
    warn(null, 'config write failed: ' + message(error));
  }
  return next;
}

function dataDir() {
  const config = loadConfig();
  return withTodoFolder(config.dataDir || userDataDir());
}

function storeFile() {
  return path.join(dataDir(), 'tasks.json');
}

/** Same volume rule the Electron build used: a moved drive keeps its identity. */
function volumeSerialOf(dirPath) {
  try {
    const root = path.parse(path.resolve(dirPath)).root;
    const serial = fs.statSync(root).dev;
    return Number.isFinite(serial) && serial > 0 ? serial : null;
  } catch {
    return null;
  }
}

function volumeRelative(dirPath) {
  try {
    const root = path.parse(path.resolve(dirPath)).root;
    return path.relative(root, path.resolve(dirPath));
  } catch {
    return '';
  }
}

function resolveBackupVolume(config) {
  if (!config.backupDir) return { dir: path.join(dataDir(), 'backups'), online: true };
  const stored = withTodoFolder(config.backupDir);
  if (!config.backupVolume) return { dir: stored, online: true };
  if (process.platform !== 'win32') return { dir: stored, online: true };
  for (const letter of DRIVE_LETTERS) {
    const root = letter + ':\\';
    try {
      if (fs.statSync(root).dev === config.backupVolume.serial) {
        return { dir: withTodoFolder(path.join(root, config.backupVolume.rel || '')), online: true };
      }
    } catch {
      /* a missing drive is not an error */
    }
  }
  return { dir: stored, online: false };
}

function backupStatus() {
  return resolveBackupVolume(loadConfig());
}

// ---------------------------------------------------------------------------
// store I/O
// ---------------------------------------------------------------------------

let cache = null;

function emptyState() {
  return { version: 1, deviceId: randomId(), tasks: [], updatedAt: 0 };
}

function randomId() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return 'device-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function validate(tasks) {
  if (!Array.isArray(tasks)) throw new Error('tasks must be an array');
  const ids = new Set();
  for (const task of tasks) {
    if (!task || typeof task.id !== 'string' || !task.id) throw new Error('task id required');
    if (ids.has(task.id)) throw new Error('duplicate task id: ' + task.id);
    ids.add(task.id);
    if (typeof task.title !== 'string' || !task.title.trim()) throw new Error('task title required');
  }
  for (const task of tasks) {
    if (task.parentId !== null && task.parentId !== undefined && !ids.has(task.parentId)) {
      throw new Error('task ' + task.id + ' has missing parent ' + task.parentId);
    }
  }
}

function readStore() {
  if (cache) return cache;
  const file = storeFile();
  if (!fs.existsSync(file)) {
    cache = emptyState();
    return cache;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    cache = {
      version: 1,
      deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : randomId(),
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
    };
  } catch (error) {
    try {
      fs.renameSync(file, file + '.corrupt-' + Date.now());
    } catch {
      /* the original stays readable */
    }
    warn(null, 'store unreadable, starting clean: ' + message(error));
    cache = emptyState();
  }
  return cache;
}

function writeStore(tasks) {
  validate(tasks);
  const file = storeFile();
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const next = {
    version: 1,
    deviceId: readStore().deviceId,
    tasks,
    updatedAt: Date.now(),
  };
  const temp = file + '.tmp-' + process.pid;
  fs.writeFileSync(temp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(temp, file);
  cache = next;
  return next;
}

// ---------------------------------------------------------------------------
// backups, export, diff
// ---------------------------------------------------------------------------

function backupsDir() {
  return backupStatus().dir;
}

function latestBackupFile() {
  try {
    const dir = backupsDir();
    const files = fs.readdirSync(dir).filter((file) => file.startsWith('tasks-') && file.endsWith('.json')).sort();
    return files.length > 0 ? path.join(dir, files[files.length - 1]) : null;
  } catch {
    return null;
  }
}

function readBackupSnapshot() {
  const file = latestBackupFile();
  if (!file) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed.tasks)) return null;
    return { file, tasks: parsed.tasks, deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : null };
  } catch {
    return null;
  }
}

function backupNow() {
  const status = backupStatus();
  if (status.online === false) throw new Error('备份盘未连接，请接入后重试');
  const file = storeFile();
  if (!fs.existsSync(file)) throw new Error('还没有任务数据可备份');
  const dir = status.dir;
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, 'tasks-' + stamp + '.json');
  fs.copyFileSync(file, target);
  const files = fs.readdirSync(dir).filter((name) => name.startsWith('tasks-') && name.endsWith('.json')).sort();
  while (files.length > BACKUP_KEEP) {
    try {
      fs.unlinkSync(path.join(dir, files.shift()));
    } catch {
      /* a locked older backup may stay */
    }
  }
  return { ok: true, file: target };
}

function autoBackupQuiet() {
  try {
    backupNow();
    return true;
  } catch {
    return false;
  }
}

function buildDiff() {
  const status = backupStatus();
  if (status.online === false) return { online: false, backupFile: null, diff: [] };
  const snapshot = readBackupSnapshot();
  if (!snapshot) return { online: true, backupFile: null, empty: true, diff: [] };
  const localMap = new Map((readStore().tasks || []).map((task) => [task.id, task]));
  const backupMap = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const diff = [];
  for (const [id, local] of localMap) {
    const backup = backupMap.get(id);
    if (!backup) {
      diff.push({ id, kind: 'local-only', title: local.title });
      continue;
    }
    if (JSON.stringify(local) !== JSON.stringify(backup)) {
      diff.push({
        id,
        kind: 'changed',
        title: local.title,
        localVersion: Number(local.version) || 0,
        backupVersion: Number(backup.version) || 0,
      });
    }
  }
  for (const [id, backup] of backupMap) {
    if (!localMap.has(id)) diff.push({ id, kind: 'backup-only', title: backup.title });
  }
  return { online: true, backupFile: snapshot.file, deviceId: snapshot.deviceId, diff };
}

function exportStore() {
  const file = path.join(dataDir(), 'tasks.export.json');
  const state = readStore();
  const payload = {
    version: 1,
    deviceId: state.deviceId,
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, file, count: state.tasks.length };
}

function applyDiffChoices(choices) {
  const snapshot = readBackupSnapshot();
  if (!snapshot) throw new Error('没有可用的备份快照');
  const state = readStore();
  const local = new Map(state.tasks.map((task) => [task.id, task]));
  const backup = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const picked = choices && typeof choices === 'object' ? choices : {};
  for (const [id, which] of Object.entries(picked)) {
    const source = which === 'backup' ? backup.get(id) : local.get(id);
    if (!source) {
      local.delete(id);
      continue;
    }
    local.set(id, { ...source, updatedAt: Date.now() });
  }
  const tasks = [...local.values()];
  writeStore(tasks);
  return { ok: true, count: tasks.length };
}

// ---------------------------------------------------------------------------
// http
// ---------------------------------------------------------------------------

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 8_000_000) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function configPayload() {
  const config = loadConfig();
  const status = backupStatus();
  return {
    ok: true,
    dataDir: dataDir(),
    dataDefault: withTodoFolder(userDataDir()),
    backupDir: status.dir,
    backupDefault: path.join(dataDir(), 'backups'),
    backupOnline: status.online,
    autoBackup: { ...DEFAULT_AUTO, ...config.autoBackup },
  };
}

async function handle(ctx, req, res) {
  const url = new URL(req.url || ROUTE_PREFIX, 'http://todo-list.invalid');
  const route = url.pathname.slice(ROUTE_PREFIX.length) || '/';
  try {
    if (req.method === 'GET') {
      if (route === '/state') {
        const state = readStore();
        return sendJson(res, 200, {
          ok: true,
          tasks: state.tasks,
          deviceId: state.deviceId,
          dataDir: dataDir(),
          updatedAt: state.updatedAt,
        });
      }
      if (route === '/config') return sendJson(res, 200, configPayload());
      if (route === '/info') {
        const state = readStore();
        return sendJson(res, 200, { ok: true, dataDir: dataDir(), deviceId: state.deviceId });
      }
      if (route === '/diff') return sendJson(res, 200, { ok: true, ...buildDiff() });
      return sendJson(res, 404, { ok: false, error: 'not found' });
    }
    if (req.method !== 'POST' && req.method !== 'PUT') {
      return sendJson(res, 405, { ok: false, error: 'method not allowed' });
    }
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'cross-origin write refused' });
    const body = await readJson(req);
    if (route === '/tasks') {
      const tasks = Array.isArray(body.tasks) ? body.tasks : [];
      const state = writeStore(tasks);
      return sendJson(res, 200, { ok: true, tasks: state.tasks, updatedAt: state.updatedAt });
    }
    if (route === '/backup') return sendJson(res, 200, { ok: true, ...backupNow() });
    if (route === '/export') return sendJson(res, 200, exportStore());
    if (route === '/auto-backup') {
      const settings = body.settings && typeof body.settings === 'object' ? body.settings : {};
      const config = saveConfig({ autoBackup: { ...DEFAULT_AUTO, ...settings } });
      return sendJson(res, 200, { ok: true, autoBackup: config.autoBackup });
    }
    if (route === '/apply-diff') return sendJson(res, 200, applyDiffChoices(body.choices));
    return sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (error) {
    warn(ctx, 'request failed: ' + message(error));
    return sendJson(res, 400, { ok: false, error: message(error) });
  }
}

function mountRoutes(ctx) {
  ctx.inject(['webServer'], (web) => {
    const server = web && web.webServer;
    if (!server || typeof server.register !== 'function') return;
    let dispose;
    try {
      dispose = server.register({ kind: 'prefix', path: ROUTE_PREFIX, handler: (req, res) => handle(ctx, req, res) });
    } catch (error) {
      warn(ctx, 'route not registered: ' + message(error));
      return;
    }
    ctx.effect(() => () => {
      try {
        dispose();
      } catch {
        /* route already gone */
      }
    }, 'todo-list: http route');
  });
}

// ---------------------------------------------------------------------------
// agent tools (deliberately separate from task_list / task_write)
// ---------------------------------------------------------------------------

const outputShape = {
  type: 'object',
  additionalProperties: false,
  properties: { text: { type: 'string' } },
};

function renderText(_args, value) {
  const text = value && typeof value.text === 'string' ? value.text : '';
  return [{ type: 'text', text }];
}

function formatTree(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return '待办列表是空的。';
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const children = new Map();
  const roots = [];
  for (const task of tasks) {
    const parentId = task.parentId || null;
    if (!parentId || !byId.has(parentId)) {
      roots.push(task);
      continue;
    }
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(task);
  }
  const lines = [];
  const walk = (task, depth) => {
    const tags = [];
    if (task.status && task.status !== 'pending') tags.push(task.status);
    if (task.priority && task.priority !== 'medium') tags.push(task.priority);
    if (task.category) tags.push(task.category);
    if (task.group) tags.push('#' + task.group);
    if (task.deadline) tags.push('截止 ' + task.deadline);
    if (task.blocked) tags.push('阻塞');
    if (task.focused) tags.push('焦点');
    if (task.paused) tags.push('暂停');
    lines.push('  '.repeat(depth) + '- ' + task.title + (tags.length > 0 ? ' [' + tags.join(', ') + ']' : '') + ' (' + task.id + ')');
    for (const child of children.get(task.id) || []) walk(child, depth + 1);
  };
  const done = tasks.filter((task) => task.status === 'completed').length;
  lines.push('待办列表（' + done + '/' + tasks.length + ' 已完成）：');
  for (const root of roots) walk(root, 0);
  return lines.join('\n');
}

function todoListTool() {
  return {
    name: 'todo_list',
    description: 'Read the user\'s personal todo list (「抱怨先生的待办列表」, the panel in the right Sidebar). '
      + 'This is NOT the session task list used by task_list / task_write: it is a single global list the user '
      + 'maintains by hand, with two levels, five states, categories (daily / monthly / deadline / infinite) and '
      + 'free-form groups. Read it when the user asks what is on their plate; add or change entries with '
      + 'todo_add / todo_update.',
    parameters: {
      type: 'object',
      properties: {
        includeCompleted: {
          type: 'boolean',
          description: 'Also list completed and abandoned tasks (default: only open ones).',
        },
      },
    },
    output: { schema: outputShape, render: renderText },
    execute(args) {
      const all = refreshRecurring(migrateTasks(readStore().tasks).tasks, Date.now()).tasks;
      const include = Boolean(args && args.includeCompleted === true);
      const visible = include
        ? all
        : all.filter((task) => task.status !== 'completed' && task.status !== 'abandoned');
      return Promise.resolve({ text: formatTree(deriveStatus(visible)) });
    },
  };
}

function todoAddTool() {
  return {
    name: 'todo_add',
    description: 'Add one task to the user\'s personal todo list. Use `parentId` for a subtask (two levels only). '
      + 'Returns the new task id, which todo_update needs.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task name.' },
        notes: { type: 'string', description: 'Details, or the reason a task is blocked.' },
        parentId: { type: 'string', description: 'Id of the parent task, for a subtask.' },
        category: { type: 'string', enum: [...CATEGORIES], description: 'daily | monthly | deadline. Omit for the "infinite" category.' },
        deadline: { type: 'string', description: 'ISO date (YYYY-MM-DD) for a limited-time task.' },
        group: { type: 'string', description: 'Free-form group name inside the category.' },
        priority: { type: 'string', enum: [...PRIORITIES], description: 'high | medium | low (default medium).' },
        status: { type: 'string', enum: [...STATUSES], description: 'pending | in_progress | review | completed | abandoned (default pending).' },
        blocked: { type: 'boolean', description: 'Waiting on something outside the list; put the reason in notes.' },
      },
      required: ['title'],
    },
    output: { schema: outputShape, render: renderText },
    execute(args) {
      const input = args && typeof args === 'object' ? args : {};
      const state = readStore();
      const created = createTask({
        title: input.title,
        notes: input.notes,
        parentId: input.parentId,
        category: input.category,
        deadline: input.deadline,
        group: input.group,
        priority: input.priority,
        status: input.status,
        blocked: input.blocked === true,
        origin: 'agent',
        order: nextOrderIn(state.tasks, input.parentId),
      });
      const tasks = insertTask(state.tasks, created);
      writeStore(tasks);
      return Promise.resolve({
        text: '已添加：' + created.title + '（id: ' + created.id + '）',
      });
    },
  };
}

function nextOrderIn(tasks, parentId) {
  const parent = parentId || null;
  let max = -1;
  for (const task of tasks) {
    const taskParent = task.parentId || null;
    if (taskParent !== parent) continue;
    const order = Number.isFinite(task.order) ? task.order : 0;
    if (order > max) max = order;
  }
  return max + 1;
}

function todoUpdateTool() {
  return {
    name: 'todo_update',
    description: 'Change one task in the user\'s personal todo list: status, title, notes, priority, category, '
      + 'group, deadline, blocked flag, or remove it entirely. Only the fields you pass change.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task id, as returned by todo_list or todo_add.' },
        title: { type: 'string', description: 'New title.' },
        notes: { type: 'string', description: 'New note text.' },
        status: { type: 'string', enum: [...STATUSES], description: 'pending | in_progress | review | completed | abandoned' },
        priority: { type: 'string', enum: [...PRIORITIES], description: 'high | medium | low' },
        category: { type: 'string', enum: [...CATEGORIES], description: 'daily | monthly | deadline; pass null to clear.' },
        group: { type: 'string', description: 'Group name; pass an empty string to clear.' },
        deadline: { type: 'string', description: 'ISO date; pass an empty string to clear.' },
        blocked: { type: 'boolean', description: 'Waiting on something outside the list.' },
        focused: { type: 'boolean', description: 'Pin this task as the current focus.' },
        paused: { type: 'boolean', description: 'Pause the task without changing its state.' },
        remove: { type: 'boolean', description: 'Remove this task and its subtasks.' },
      },
      required: ['id'],
    },
    output: { schema: outputShape, render: renderText },
    execute(args) {
      const input = args && typeof args === 'object' ? args : {};
      if (typeof input.id !== 'string' || !input.id) throw new Error('id is required');
      const state = readStore();
      if (!state.tasks.some((task) => task.id === input.id)) throw new Error('task not found: ' + input.id);
      if (input.remove === true) {
        const tasks = removeSubtree(state.tasks, input.id);
        writeStore(tasks);
        return Promise.resolve({ text: '已删除 ' + input.id });
      }
      const patch = {};
      for (const key of ['title', 'notes', 'priority']) {
        if (typeof input[key] === 'string') patch[key] = input[key];
      }
      if (input.category === null || typeof input.category === 'string') patch.category = input.category || null;
      if (typeof input.group === 'string') patch.group = input.group.trim() || null;
      if (typeof input.deadline === 'string') patch.deadline = input.deadline || null;
      if (typeof input.blocked === 'boolean') patch.blocked = input.blocked;
      if (typeof input.focused === 'boolean') patch.focused = input.focused;
      if (typeof input.paused === 'boolean') patch.paused = input.paused;
      let tasks = typeof input.status === 'string'
        ? setStatus(state.tasks, input.id, input.status, { now: Date.now() })
        : state.tasks;
      if (Object.keys(patch).length > 0) tasks = patchList(tasks, input.id, patch, { now: Date.now() });
      writeStore(tasks);
      return Promise.resolve({ text: '已更新 ' + input.id });
    },
  };
}

// ---------------------------------------------------------------------------
// automatic backup
// ---------------------------------------------------------------------------

function armAutoBackup(ctx) {
  ctx.effect(() => {
    const arm = () => {
      const every = Number(loadConfig().autoBackup && loadConfig().autoBackup.every) || 0;
      if (every <= 0) return () => {};
      const timer = ctx.interval(() => {
        autoBackupQuiet();
      }, every * 60_000);
      return timer;
    };
    let stop = arm();
    return () => {
      if (typeof stop === 'function') stop();
    };
  }, 'todo-list: auto backup timer');
}

export function apply(ctx) {
  ctx.effect(() => ctx.tools.register(todoListTool()), 'todo-list: tool todo_list');
  ctx.effect(() => ctx.tools.register(todoAddTool()), 'todo-list: tool todo_add');
  ctx.effect(() => ctx.tools.register(todoUpdateTool()), 'todo-list: tool todo_update');
  mountRoutes(ctx);
  armAutoBackup(ctx);
}
