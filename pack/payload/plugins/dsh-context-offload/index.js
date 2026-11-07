/**
 * Context offload — Host half.
 *
 * Two triggers:
 *  1. pressure  — at a turn boundary, if context used / window >= threshold,
 *                 move large tool results out of the surface.
 *  2. delivery  — when the session's task list shows a newly completed task,
 *                 clean up results produced before that completion.
 *
 * In both cases: write full text to disk, append an index row, then replace the
 * surface node with a one-line pointer.
 */
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DEFAULTS = {
  /** Offload when used / window reaches this ratio (pressure trigger). */
  threshold: 0.35,
  /** Offload until used / window falls to this ratio. Must be below `threshold`. */
  targetRatio: 0.2,
  /** Only tool results at least this large are candidates. */
  maxToolResultChars: 5000,
  /** Never touch results from the newest N turns (pressure trigger). */
  hotTurns: 2,
  /** Max results cleaned per delivery event. */
  deliveryMaxItems: 20,
  /** Where full text, INDEX.md, state.json and the log live. */
  archiveRoot: 'F:\\DSH\\projects\\_offload',
  /** Log what would happen without replacing anything. */
  dryRun: false,
  /** Tool results that carry live task state and must never be offloaded. */
  excludeTools: ['task_list', 'task_write', 'task_edit', 'todo_list', 'todo_add', 'todo_update'],
}

export function apply(ctx, rawConfig = {}) {
  const cfg = { ...DEFAULTS, ...(rawConfig ?? {}) }
  let busy = false

  const handler = async (payload = {}) => {
    const agent = payload.agent
    if (!agent || busy) return
    busy = true
    try {
      await offload(ctx, agent, cfg, payload.turn)
    } catch (error) {
      await safeLog(cfg, `error: ${error?.message ?? String(error)}`)
    } finally {
      busy = false
    }
  }

  const dispose = ctx.on('agent/turn-stopping', handler)
  void safeLog(cfg, `plugin loaded v0.2.0 dryRun=${cfg.dryRun} threshold=${cfg.threshold}`)
  return dispose
}

async function offload(ctx, agent, cfg, turn) {
  const sessions = ctx.get('sessions')
  const meter = ctx.get('tokenMeter')
  if (!sessions || !meter) return

  const session = sessions.get(agent.id)
  if (!session) return

  const pressure = meter.contextPressure(session)
  const used = pressure?.pressureTokens
  const windowSize = pressure?.contextWindow
  if (!used || !windowSize) return
  const ratio = used / windowSize
  await safeLog(cfg, `pressure used=${used} window=${windowSize} ratio=${ratio.toFixed(3)}`)

  const state = await readState(cfg)
  const sessionState = state?.sessions?.[agent.id] ?? {}
  const lastCompletedAt = typeof sessionState.lastCompletedAt === 'number' ? sessionState.lastCompletedAt : 0
  const completedAt = await readTaskCompletion(agent.id)
  const deliveryMode = completedAt > lastCompletedAt && completedAt > 0

  await safeLog(
    cfg,
    `task completion=${completedAt} last=${lastCompletedAt} delivery=${deliveryMode}`,
  )

  if (!deliveryMode && ratio < cfg.threshold) return

  const measurement = meter.measure(session)
  const nodes = measurement?.nodes ?? []
  const currentTurn = typeof turn === 'number' ? turn : Number.POSITIVE_INFINITY
  const excluded = new Set(cfg.excludeTools ?? [])

  const candidates = []
  let nodeCount = 0
  let toolCount = 0
  let largeCount = 0
  let hotSkipped = 0
  let excludedSkipped = 0
  let timeSkipped = 0
  let maxChars = 0
  for (const node of nodes) {
    nodeCount++
    const event = session.eventAt(node.seq)
    if (!event || event.type !== 'tool/result') continue
    toolCount++
    const data = event.data ?? {}
    const message = data.message
    if (!message || message.isError) continue
    const chars = textLength(message.content)
    if (chars > maxChars) maxChars = chars
    if (chars < cfg.maxToolResultChars) continue
    largeCount++
    const call = toolCallFor(session, node.seq, message.toolCallId)
    const name = call?.name
    if (name && excluded.has(name)) {
      excludedSkipped++
      continue
    }
    if (deliveryMode) {
      if (typeof event.time === 'number' && event.time >= completedAt) {
        timeSkipped++
        continue
      }
      if (typeof data.turn === 'number' && data.turn > currentTurn - 1) {
        hotSkipped++
        continue
      }
    } else if (typeof data.turn === 'number' && data.turn > currentTurn - cfg.hotTurns) {
      hotSkipped++
      continue
    }
    candidates.push({ seq: node.seq, chars, tokens: node.tokens ?? 0, event, toolName: name, toolArgs: call?.arguments })
  }
  candidates.sort((a, b) => a.seq - b.seq)
  await safeLog(
    cfg,
    `scan nodes=${nodeCount} tools=${toolCount} large=${largeCount} hot=${hotSkipped} excluded=${excludedSkipped} time=${timeSkipped} maxChars=${maxChars} candidates=${candidates.length} mode=${deliveryMode ? 'delivery' : 'pressure'} turn=${turn}`,
  )

  if (deliveryMode) {
    await writeState(cfg, {
      sessions: { ...(state?.sessions ?? {}), [agent.id]: { lastCompletedAt: completedAt } },
    })
    let moved = 0
    for (const candidate of candidates) {
      if (moved >= cfg.deliveryMaxItems) break
      if (await offloadOne(session, candidate, cfg)) moved++
    }
    await safeLog(cfg, `delivery cleanup moved=${moved} candidates=${candidates.length} completedAt=${completedAt}`)
    return
  }

  const targetRatio = cfg.targetRatio ?? 0.2
  const targetFree = Math.max(0, used - Math.floor(windowSize * targetRatio))
  if (targetFree <= 0) {
    await safeLog(cfg, `target-already-met used=${used} target=${Math.floor(windowSize * targetRatio)}`)
    return
  }

  let freed = 0
  for (const candidate of candidates) {
    if (freed >= targetFree) break
    const moved = await offloadOne(session, candidate, cfg)
    if (moved) freed += candidate.tokens
  }
  if (freed > 0) await safeLog(cfg, `freed tokens=${freed} target=${targetFree} candidates=${candidates.length}`)
}

async function readTaskCompletion(sessionId) {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const file = join(home, 'storages', 'task-list', `${sessionId}.json`)
  try {
    const raw = await readFile(file, 'utf8')
    const data = JSON.parse(raw)
    const tasks = Array.isArray(data?.tasks) ? data.tasks : []
    let max = 0
    for (const task of tasks) {
      const ts = typeof task?.completedAt === 'number' ? task.completedAt : 0
      if (ts > max) max = ts
    }
    return max
  } catch {
    return 0
  }
}

async function readState(cfg) {
  try {
    return JSON.parse(await readFile(join(cfg.archiveRoot, 'state.json'), 'utf8'))
  } catch {
    return {}
  }
}

async function writeState(cfg, state) {
  try {
    await mkdir(cfg.archiveRoot, { recursive: true })
    await writeFile(join(cfg.archiveRoot, 'state.json'), JSON.stringify(state, null, 2), 'utf8')
  } catch {
    /* state is best-effort */
  }
}

function toolCallFor(session, seq, callId) {
  for (let s = seq - 1; s >= 0 && s > seq - 12; s--) {
    const event = session.eventAt(s)
    if (event?.type === 'tool/call' && event.data?.callId === callId) return event.data
  }
  return undefined
}

async function offloadOne(session, candidate, cfg) {
  const event = candidate.event
  const data = event.data ?? {}
  const message = data.message
  const callId = message.toolCallId
  const name = `${stamp()}-${String(session.id).slice(-8)}-${candidate.seq}-${callId}.md`
  const indexPath = join(cfg.archiveRoot, 'INDEX.md')

  let indexText = ''
  try {
    indexText = await readFile(indexPath, 'utf8')
  } catch {
    /* first run */
  }
  if (indexText.includes(`| ${session.id} | ${candidate.seq} |`)) return false

  const body = [
    '# 已卸载的工具结果',
    '',
    `- session: ${session.id}`,
    `- seq: ${candidate.seq}`,
    `- turn: ${data.turn} / step: ${data.step}`,
    `- toolCallId: ${callId}`,
    `- chars: ${candidate.chars}`,
    '',
    '---',
    '',
    textOf(message.content),
  ].join('\n')

  if (cfg.dryRun) {
    await safeLog(cfg, `dry-run seq=${candidate.seq} chars=${candidate.chars} -> ${name}`)
    return false
  }

  try {
    await mkdir(cfg.archiveRoot, { recursive: true })
    await writeFile(join(cfg.archiveRoot, name), body, 'utf8')
  } catch (error) {
    await safeLog(cfg, `write-failed seq=${candidate.seq}: ${error?.message ?? error}`)
    return false
  }

  const keyword = buildKeyword(candidate.toolName, candidate.toolArgs, message.content)

  try {
    if (!indexText) {
      await appendFile(
        indexPath,
        '| 时间 | session | seq | 字符 | 文件 | 关键词 |\n| --- | --- | --- | --- | --- | --- |\n',
        'utf8',
      )
    }
    await appendFile(
      indexPath,
      `| ${stamp()} | ${session.id} | ${candidate.seq} | ${candidate.chars} | ${name} | ${keyword} |\n`,
      'utf8',
    )
  } catch {
    /* index is best-effort; the file itself is the source of truth */
  }

  const pointer =
    `[已卸载] 原工具结果 ${candidate.chars} 字符，全文：${name}（seq ${candidate.seq}）`

  const replacement = {
    ...data,
    message: { ...message, content: [{ type: 'text', text: pointer }] },
  }

  try {
    session.append('tool/result', replacement, {
      surfaceOp: { op: 'replace', startSeq: candidate.seq, endSeq: candidate.seq },
      sourceEventSeqs: [candidate.seq],
    })
  } catch (error) {
    await safeLog(cfg, `replace-failed seq=${candidate.seq}: ${error?.message ?? error}`)
    return false
  }

  await safeLog(cfg, `offloaded seq=${candidate.seq} chars=${candidate.chars} tokens=${candidate.tokens} -> ${name}`)
  return true
}

function textLength(content) {
  let total = 0
  for (const part of content ?? []) {
    if (part?.type === 'text' && typeof part.text === 'string') total += part.text.length
  }
  return total
}

function textOf(content) {
  const parts = []
  for (const part of content ?? []) {
    if (part?.type === 'text' && typeof part.text === 'string') parts.push(part.text)
  }
  return parts.join('\n')
}

function buildKeyword(toolName, toolArgs, content) {
  const raw = toolArgs || textOf(content)
  const head = String(raw)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .replace(/\|/g, '/')
  return `${toolName ?? 'unknown'} ${head}`.trim()
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function safeLog(cfg, line) {
  try {
    await mkdir(cfg.archiveRoot, { recursive: true })
    await appendFile(join(cfg.archiveRoot, 'offload.log'), `${new Date().toISOString()} ${line}\n`, 'utf8')
  } catch {
    /* logging must never break the turn */
  }
}
