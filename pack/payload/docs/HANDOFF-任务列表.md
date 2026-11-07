# HANDOFF：DSH 任务系统重建计划（简称：任务列表）

> 项目组：DSH Web 插件（Host + Client 双半）
> 创建：2026-10-29
> 状态：后端已接入（Host 存储 + HTTP API + `task_list`/`task_write` 工具），前端已删演示数据改接真实列表；四状态节归父任务的结构重构完成，对话列/输入框已对齐并加 920 宽上限；34 条单测通过；`todo_write` 暂与旧工具并存（2026-10-29 用户决定）
> 宿主版本：dsh 0.2.1-rc.3

## 0. 新会话快速接入（三步，先读这节）

1. **确认在线**：`task_list` 能调用；`cordis_inspect_query` client `Slots.listSubTree` root `conversation.input.dock` 里 `task-list.panel` 为 `active: true`。面板不显示就刷新页面（agent 写入不会自动推送到已打开的页面）。
2. **读约定**：数据规则见 §4.2 / §12.1（四态、`origin`、`blocked`、`focused`、任务级后写胜）；布局规则见 §15（右栏开→夹在面板与右栏之间，右栏关→对话恢复默认）。
3. **开工即建表**：用 `task_write` 整表提交，每条至少 `id` / `title` / `status`，可带 `parentId` / `priority` / `notes` / `blocked`；`todo_write` 已弃用（仍注册，不要新建）。收尾用 `task_write` 更新状态。

接入即用的命令：

```
task_list                      # 读当前会话的树
task_write { tasks: [...] }    # 整表提交；缺省的 agent 条目视为撤回，user 条目保留
```

- **口令约定（用户设定）**：用户说「测试」→ 用 `task_write` 往列表里加一条标题为「测试」的待办（`status: pending`，不改动其他任务），然后简短回复。这是验证即时刷新的固定口令。
- **工作即任务（强制，2026-10-29 用户质问后补定）**：任务列表是**实时工作台账**，不是事后补记。每轮动手前先 `task_list` 读一次，把本轮要做的事建成 / 更新为 `in_progress`；每完成一项立即改 `completed`；中途改计划也照实更新。**禁止「先做完再补一条已完成」**——那样列表就退化成了事后账本，也就失去了存在意义（用户原话：我们做任务列表的意义是什么）。

安装是 link 到 `F:\DSH\projects\DSH任务系统重建计划`，改源文件即改运行文件；改 `client.js` 后需要用户刷新页面。

## 1. 目标

重建 DSH 的任务系统：一个独立于对话流的任务面板，解决现有 `todo_write` 的三个痛点：

| 痛点 | 根因（已查实） |
|---|---|
| 容易被打断 | `todos` 投影在每次 `turn/start` 重置为 `null`；用户再发一句话，上一轮清单就从界面消失 |
| 建立不及时 | 建列表完全靠 model 自觉调用 `todo_write`，用户无法干预 |
| 条目结构不清晰 | schema 只有 `content` + 三状态（pending/in_progress/completed），无 id、层级、分组、优先级、备注 |

## 2. 已确认需求（用户逐项选定）

- **联动方式：双向联动。** 用户和 agent 读写同一份任务列表。
- **范围：当前会话**（含该会话的子代理）。
- **位置：中栏（对话区）左侧的竖向空白色块。** 红框只圈大致区域，四周留和谐余量（建议 16–20px），不贴边。
- **条目结构：** 子任务层级、优先级、备注/详情、四态（待办 / 进行中 / 待确认 / 完成）。
- 数据形态：四态中的「待确认」语义 = agent 声称完成不自动结算，等人确认（参考 dsh-global-todo 的 Needs review）。

## 3. 现状事实（已从宿主源码提取，勿重查）

宿主任务系统 = `@deepseek-ai/dsh-tool-todo`（提取位置 `F:\DSH\temp\asar-extract\dsh\node_modules\@deepseek-ai\dsh-tool-todo\`）：

- 工具 `todo_write`：**整表替换**（last-write-wins），每会话一份；校验 content 非空、去重、非并发模式下最多一个 in_progress。
- 投影 `todos`：`apply` 里 `todo/write` 写入整表，**`turn/start` 置 null**，`turn/end` 保留。
- 存储：`exec.agent.session.append('todo/write', { todos })` → session 事件日志（磁盘永久保留，历史可回放）。
- UI：仅在会话流 tool call 卡片渲染（`dsh-client-ui-tool` 的 `todosDetail`），无常驻面板、无用户入口。
- 写通道：Client 的 Session 是 Host 事件只读镜像，**client 侧没有 append 事件的 API**。界面要写任务，必须有 Host 半暴露 Remote 方法。
- 自定义会话事件不可用：`KNOWN_SESSION_EVENT_TYPES` 是宿主硬编码白名单（`dsh-api-session-controller/lib/client.js` 约 L138-201），外部插件事件「outside this list by construction」，replay 会按 ignorable 处理。**不要设计新的 session 事件类型来存任务。**

布局事实：

- 三列 grid：`sidebarCol | centerCol | rightbarCol`（`dsh-client-ui-layout` 的 AppFrame）。
- 对话内容 `max-width: var(--dsh-chat-content-width)`（默认 748px）+ `margin: 0 auto` 居中，左右留白是居中产物，不是预留插槽。
- Slot 树没有「sidebar 与 main 之间」的位置；可用的通用落点是 `sidebar` / `main`(keyed) / `rightbar` / `shell.overlay`。
- 侧栏宽度可变（264–420，拖拽），折叠时 56/0；`ctx.layout` 无 getSidebar/编程设宽。

## 4. 技术方案（开工按此执行）

### 4.1 布局：占位式

1. 面板用 `react-dom` 的 `createPortal` 挂到 `document.querySelector('[class*="_centerCol"]')`。
2. 面板 `position:absolute; left/top/right/bottom` 留 16–20px 余量；宽度建议 340–400px（随中栏宽度自适应，窄屏折叠）。
3. 给聊天滚动容器（`[class*="_scroll"]` 或 `[data-slot="conversation.chat.flow"]` 的祖先）加 `padding-left`，把对话内容右移，避免面板遮挡。
4. 输入框（composer）不动，面板高度止于 composer 上方。
5. 窄屏（中栏宽度不足以容纳面板+内容）时折叠为窄条或浮层按钮。

风险：`centerCol` 有 `overflow:hidden`（子元素会被裁剪，正常）；皮肤按原生 DOM 类名写的 CSS 可能命中新 padding（参考会话分组 HANDOFF 的皮肤教训）。

### 4.2 数据：独立 JSON store，不用新投影

- Host 半用 `ctx.storage` / 自有 JSON 文件（放 `$DSH_HOME` 下，参考 dsh-crabtodo）。
- 结构（建议）：

```js
Task = {
  id: string,
  sessionId: string,          // 所属会话（当前会话过滤用）
  parentId: string | null,    // 子任务层级
  title: string,
  notes: string,              // 备注/详情
  priority: 'high' | 'medium' | 'low',
  status: 'pending' | 'in_progress' | 'review' | 'completed',
  order: number,              // 同级顺序
  origin: 'agent' | 'user',   // user 条目永不被 agent 整表提交间接删除
  blocked: boolean,           // 卡住标记：不是第五态，环上加红点角标，备注写原因
  focused: boolean,           // 每会话最多一个焦点任务，面板顶部常驻「继续」
  version: number,            // 合并用；本地 patch 与 agent 写入都 +1
  createdAt: number,
  updatedAt: number,
  completedAt: number | null,
  externalUpdateAt: number | null,  // 最近一次被拒绝的外部写入时刻；UI 提示一次后本地写清除
}
```

### 4.3 写通道（Host 半 Remote）

- `task_list(sessionId)` / `task_upsert(task)` / `task_remove(id)` / `task_setStatus(id, status)`。
- Client 半通过 `inject` 注入对应 remote 命名空间，界面操作立即写回。

### 4.4 双向合并语义（已实现为纯函数：`lib/task-store.js` + `lib/task-store.test.js`，23 条单测）

- 用户操作 = 单任务 patch，`version++`、`updatedAt = now`，立即落盘（`patchTask`）。
- agent 写 = 整表提交，按 id 合并（`mergeAgent`）：
  - 新 id 插入；已有 id 用 agent 字段覆盖 title/notes/priority/status/parentId/order，`version++`；
  - 提交里缺失的 **`origin: 'user'` 条目保留**（agent 无法间接删除用户条目）；缺失的 agent 条目删除（视为 agent 撤回）；删除用户条目只能靠显式 `removeTask`。
  - origin 一经创建不变：agent 可更新用户条目的字段，但该条目仍是 user（后续缺失也不会被删）。
- 冲突：任务级后写胜，比较 `updatedAt`：
  - 用户更新时间更晚 → 保留用户版本，`conflicts.push(id)`，幸存任务打 `externalUpdateAt = agent 写入时刻`（UI 提示一次）；
  - 相等 → agent 胜（用户每次本地写都会推进 `updatedAt`，相等说明用户没动过）。
  - 不做字段级三方合并（无 base 快照，成本高于收益），冲突以整任务为单位记录。**2026-10-29 用户确认：保持任务级后写胜。**
- `completedAt`：进入 completed 时写时刻，离开时置 null；重复设同一状态不改写。
- 结构校验：合并后跑 `assertValidTree`，父不存在、自指、成环都抛错（不让坏提交产生不可达子树）。
- 旧会话兼容：`importLegacyTodos` 把历史 `todo_write` 的 `{content, status}` 一次性映射成 agent 条目（三态；`order` = 下标；未知状态按 pending），只读导入，不做双向同步。
- 时间与 id 全部注入（`options.now` / `options.idFactory`），单测因此完全确定。

## 5. 候选插件对比（已查 npm 包源码骨架）

| 插件 | 形态 | 数据 | 位置 | 结论 |
|---|---|---|---|---|
| `dsh-tool-todo-plus` 0.7.4 | todo_write fork + 浮动面板（fixed、可拖拽、240/380 宽） | content+status+priority | 浮动面板 | 无层级/备注/四态；不匹配 |
| `dsh-crabtodo` 0.2.4 | Host 工具(CRUD) + JSON store + Client 侧栏整页 | title/notes/status/priority/tags/scope/pinned/order/soft-delete | 侧栏整页 | 有备注/优先级/双向工具，**无父子层级、无「待确认」四态**；位置不对 |
| `dsh-global-todo` 0.21.0 | Host 服务 + Client 面板（跨会话、手机端、多机同步） | 四态含 Needs review、编号交接 | fixed 面板 | 四态语义最接近，但架构与目标范围远超需求 |

**结论：没有一个能直接改出目标形态，自研边界＝数据层 + 界面层全部自研。** 可借鉴：

- tool-todo-plus：从对话读 `todo_write`、fixed 面板定位与拖拽、面板宽度收起/展开（240/380）。
- crabtodo：Host 工具 CRUD + JSON store、`output.render` 防御式访问、软删除。
- global-todo：「完成 = 声明，需人确认」的四态语义、面板宽窄自适应（`position: fixed` 的理由在 `docs/DESIGN.md` §253）。

不 fork 任何一个：它们在位置、范围、状态机上的假设都与本项目冲突，改造比重写贵。

## 6. 风险清单

1. 双向合并冲突语义（最大风险，先写规则再写代码）。
2. 占位式布局挤压对话：中栏窄时面板与 748px 内容宽度打架，必须做折叠阈值。
3. 皮肤兼容：`dsh-claude-style` 按宿主原生 DOM 类名写 CSS；自绘面板需按 token 走，padding 改动要实测皮肤。
4. 面板挂载点靠 `[class*="_centerCol"]` 选择器，类名哈希会变但后缀稳定（同 `_handle` 经验）。
5. 旧会话数据导入：只读回放，不承诺双向同步。

## 7. 分阶段与进度

- **P0 骨架**：Client 半面板 portal + 占位布局 ✅；Host store + Remote ❌；读写闭环 ❌
- **P1 结构**：父子层级 ✅、优先级 ✅、备注 ✅、四态 ✅（父任务推导、阻塞标记、焦点）
- **P2 联动**：合并规则 ✅（纯函数 + 23 单测）；agent 工具 ❌；冲突提示 ❌（字段已备，UI 未接）
- **P3 打磨**：窄屏折叠 ✅、皮肤 ✅、键盘 ✅、历史导入 ❌（`importLegacyTodos` 有，默认不跑）

## 8. 下一步（新会话从这里开始）

### 交接状态（2026-10-29 第七轮）

- 前端交互全部完成，但仍跑内存 DEMO，刷新还原。
- 合并规则纯函数 + 23 条单测完成（`lib/task-store.js`）。
- 本轮新增：阻塞标记、焦点、恢复提示（§10.3 末条）。
- 交付包 v0.2.1 已导出并双备份（§11），含当前全部前端改动。
- **后端一行未动**：`index.js` 还是空 `apply`。

### 后端开工顺序

1. **存储层**：`$DSH_HOME/task-list/<sessionId>.json`，结构 `{ version, sessionId, tasks, updatedAt }`；临时文件 + rename 原子写；损坏时备份重建。
2. **Remote**：`task_list(sessionId)`（返回推导值后的树）/ `task_update` / `task_create` / `task_remove` / `task_setStatus`；写路径全部走 `lib/task-store.js`，agent 整表提交走 `mergeAgent`。
3. **前端对接**：删 DEMO、读 remote、乐观更新 + 失败回滚、`externalUpdateAt` 显示一次「已被外部更新」。
4. **agent 工具**：`task_list` + `task_write`；同时移除 `todo_write`（先查 `ctx.tools.restrict()` 或 patch 掉 `include:tool-todo`）。
5. **新建/编辑 UI**：头部「+」建大任务、父任务悬停「+」建子任务、备注与优先级行内编辑。
6. **边界**：fork 复制任务、归档保留、删除级联、无会话时面板行为。

### 动工前要查的工程事实

- Remote 的注册方式（`ctx.remote` 命名空间 + Client `inject`）。
- `todo_write` 的移除手段（`ctx.tools.restrict()` 或 patch 禁用 `include:tool-todo`）。
- 会话 fork 的事件钩子（fork 时复制任务文件）。
- `$DSH_HOME` = `C:\Users\Administrator\.dsh`。

### 验证命令

- `C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe --check client.js`
- `C:\...\node.exe --test lib/task-store.test.js` → 23 passed
- `cordis_inspect_query` client `Slots.listSubTree` root `conversation.input.dock` → `task-list.panel` `active: true`

## 9. 文件地图（当前）

```
F:\DSH\projects\DSH任务系统重建计划\   ← 插件根（install_bundle 直接 link 此目录）
  package.json      bundle 清单：dsh.bundle.patch + dsh.client（web / immediately / inject layout+conversation）；scripts.test
  cordis.patch.yml  insert 行 id=task-list
  index.js          Host 半空 apply（等 P0 数据层接在这里）
  client.js         全部 UI：portal、viewArea 占位、大任务/小任务/状态节/卡片、双环、拖拽、进度环、阻塞/焦点/恢复提示
  lib/task-store.js        合并规则纯函数（create/patch/merge/remove/import，无 I/O）
  lib/task-store.test.js   node:test 单测，23 条
  locale/zh.json    meta.title=任务列表
  locale/en.json    meta.title=Task List
  icon.svg          青绿底清单图标
  HANDOFF-任务列表_2026-10-29.md   ← 本文件
```

跑单测：`& "C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" --test lib/task-store.test.js`（PATH 里没有 node，`npm test` 跑不起来，必须用这个绝对路径）。
