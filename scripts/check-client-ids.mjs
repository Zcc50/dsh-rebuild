#!/usr/bin/env node
/**
 * 回归检查：每个带浏览器端（dsh.client）的插件，其 client 入口必须
 * 恰好注册一次，且 __ModuleLoader__.load({ id }) 的 id 等于 package.json 的 name。
 *
 * 为什么必须一致（DSH 0.2.2-rc.5 起）：
 *   rc.5 的 client 模块装载器用 id 建工厂表，并用 id 反查包的 package.json；
 *   id 与包名不一致时该资源被判为未注册，装载器再用单资源 URL 回退重放同一份
 *   bundle，第二次执行直接抛 duplicate factory registration，插件的 apply 永远
 *   不会执行——表现就是面板静默消失。
 *
 * 做法：只 import client 入口、绝不调用它的 factory；用桩替换
 * window.__ModuleLoader__，记录 id 后断言。每个文件只 import 一次。
 *
 * 用法：node scripts/check-client-ids.mjs（或 pnpm check:client-ids）
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 根目录插件本体 + 仓库内其余自研插件（含 pack/payload 下的发行副本）。
const PACKAGE_DIRS = [
  '.',
  'task-list',
  'todo-list',
  'pack/payload/plugins/dsh-workspace-frontend',
  'pack/payload/plugins/dsh-task-list',
  'pack/payload/plugins/dsh-todo-list',
  'pack/payload/plugins/dsh-vision',
];

const rows = [];
const problems = [];

for (const rel of PACKAGE_DIRS) {
  const dir = path.join(ROOT, rel);
  const label = rel === '.' ? '根目录 (.)' : rel;

  let pkg;
  try {
    pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      rows.push({ label, status: 'skip', note: '没有 package.json' });
      continue;
    }
    problems.push({ label, message: `package.json 解析失败：${error.message}` });
    continue;
  }

  if (!pkg.dsh || !pkg.dsh.client) {
    rows.push({ label, name: pkg.name, status: 'skip', note: '未声明 dsh.client，跳过' });
    continue;
  }

  const entryRel = pkg.exports && pkg.exports['./client'];
  if (typeof entryRel !== 'string') {
    problems.push({ label, name: pkg.name, expected: pkg.name, message: 'exports["./client"] 未声明 client 入口' });
    continue;
  }

  const clientPath = path.join(dir, entryRel);
  const ids = [];
  globalThis.window = {
    __ModuleLoader__: {
      load(entry) {
        ids.push(entry && entry.id);
      },
    },
  };

  let importError = null;
  try {
    // 只求值模块顶层（即那次 load 调用），不实例化 factory。
    await import(pathToFileURL(clientPath).href);
  } catch (error) {
    importError = error;
  }

  const row = { label, name: pkg.name, expected: pkg.name, entry: entryRel, ids };
  rows.push(row);

  if (importError) {
    problems.push({ ...row, message: `import 失败：${importError.message}` });
    continue;
  }
  if (ids.length !== 1) {
    problems.push({
      ...row,
      actual: ids.length === 0 ? '(未注册)' : ids.join(', '),
      message: ids.length === 0
        ? '没有调用 __ModuleLoader__.load'
        : `注册了 ${ids.length} 次（应恰好 1 次）`,
    });
    continue;
  }
  if (ids[0] !== pkg.name) {
    problems.push({ ...row, actual: String(ids[0]), message: 'id 与 package.json 的 name 不一致' });
  }
}

delete globalThis.window;

const PASS = '✓';
const FAIL = '✗';

console.log('Client 模块注册检查（id 必须等于 package.json 的 name）\n');
for (const row of rows) {
  if (row.status === 'skip') {
    console.log(`-  ${row.label}${row.name ? ` (${row.name})` : ''}：跳过——${row.note}`);
    continue;
  }
  const bad = problems.find((p) => p.label === row.label);
  if (bad) {
    console.log(`${FAIL}  ${row.label}｜包名=${row.name}｜期望 id=${row.expected}｜实际 id=${bad.actual ?? '(未注册)'}｜入口=${row.entry}`);
  } else {
    console.log(`${PASS}  ${row.label}｜包名=${row.name}｜id=${row.ids[0]}｜入口=${row.entry}`);
  }
}

if (problems.length > 0) {
  console.error(`\n${FAIL} 失败 ${problems.length} 项：`);
  for (const problem of problems) {
    console.error(`  - ${problem.label}${problem.name ? ` (${problem.name})` : ''}：${problem.message}`);
    if (problem.expected !== undefined) {
      console.error(`      期望 id：${problem.expected}`);
      console.error(`      实际 id：${problem.actual ?? '(未注册)'}`);
    }
  }
  console.error('\n修法：把 client 入口里 __ModuleLoader__.load({ id }) 的 id 改成 package.json 的 name（含 @scope/ 前缀，如果包名带的话）；同一文件的 CSS 归属 data-plugin 也要跟着改。');
  process.exitCode = 1;
} else {
  console.log('\n全部通过：所有 client 入口只注册一次，且 id 与包名一致。');
}
