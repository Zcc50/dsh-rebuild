# 任务列表（DSH 任务系统重建计划）— 安装说明

> 正式名：DSH 任务系统重建计划　简称：任务列表
> 版本：0.3.19（含 0.3.5–0.3.19 全部能力：废弃第五态与底部常驻分区、完成态默认折叠、展开/收起滑入滑出动画、折叠指针整合到状态环、父任务环与工作区美化对齐、拖拽进「完成」节修复、底部「已完成」停靠区隐藏/滑出动画（悬停滑出、点击钉住）、样式作用域隔离（防待办插件同名类覆盖）、footer 版本号、agent 增量工具 task_edit、父行 review 派生；父子结构规则自 0.3.4 起生效）
> 包名：`@local/dsh-task-list`
> 宿主：dsh 0.2.1-rc.3（profile `desktop`）

## 这是什么

对话区左侧的一个常驻任务面板，用来替代 `todo_write` 那块容易被下一轮对话冲掉的清单。
本版**前后端都已接通**：面板与 agent 读写同一份按会话落盘的列表，刷新不丢、fork 会带走。

## 界面结构

```
⊙ 重建 DSH 任务面板            3      ← 大任务节头（进度环在左）
  ⌄ ⊙ 设计数据结构与合并规则            ← 父任务行（可折叠）
  ┌ 待办 ─────────────────┐
  │  ⊙ 设计数据结构与合并规则 │          ← 卡片（框内扁平行，不再各自成框）
  └───────────────────────┘
  ┌ 进行中 ───────────────┐              ← 空节：虚线框、无底色
  └───────────────────────┘
  ⊙ 旧会话 todo/write 只读导入           ← 无子任务的顶层任务单行
  ┌ 废弃 ───────────────── 1 ┐
  │  ⊙ 换掉宿主的旧清单          │        ← 常驻分区：写死的任务单独成段
  └───────────────────────┘
```

> 「废弃」分区固定在列表最底部，**空时也显示**（虚线框 +「暂无废弃任务」）。

## 交互

- **状态环**：行首双环标记（外环 r6.2、内环 r3.6、四个内点），切换状态时先退出动画（弧线收缩 + 反向旋转）再进入（旋转 + 填充）；颜色：待办灰、进行中品牌橙、待确认橙黄、完成绿、**废弃红**。
- **废弃（0.3.5）**：行菜单「⋯ → 废弃任务」把任务写死（无法实现或思路改了）。它立刻离开父任务的状态节、落到列表底部的「废弃」分区，环变红；数据里保留 `parentId` 与 `abandonedFrom`，点环或菜单「恢复任务」回到原来的节与原状态。废弃父任务时整棵子树一起让位，恢复父任务时子任务自动回来；只废弃子任务时只移它自己。
- **切换状态两条路**：点环循环（待办 → 进行中 → 待确认 → 完成）；把卡片拖到任意状态节（松手即改，卡片带 240ms 滑动动画）。
- **父任务只读**：父的状态完全由子任务推导（全部完成 → 完成；有完成或任一子任务活动 → 进行中；全部待办 → 待办），点父的环不生效。
- **行操作**：悬停出现操作组 —— 上移 / 下移 / 新建子任务 / ⋯ 菜单（阻塞、焦点、备注、重命名）/ 删除（两段式确认）；父任务行的操作组最左侧多出一个 ▶/⏸ 切换按钮。卡片可直接拖到任意状态节，**拖到该节的卡片上同样能投放**。
- **新建**：头部 `+` 建顶层任务，行尾 `＋` 建子任务；草稿行在列表最上方，回车创建、Esc 取消。
- **备注与优先级**：卡片展开后备注右侧 hover 出现铅笔，textarea + 保存/取消（Ctrl+Enter 也保存）；行首 3px 竖条是按钮，点击循环 高 → 中 → 低。
- **数据**：每会话一份 `~/.dsh/storages/task-list/<sessionId>.json`，原子写、损坏自动备份重建；agent 侧是同一份列表的 `task_list`（读）/ `task_edit`（单条增删改）/ `task_write`（整表替换）。
- **键盘**：点中一行后 ↑↓ 移动、Enter 切状态、Del 删除、Esc 取消。
- **题头进度环**：24px 上下文环，外环随完成度增长（浅灰 → 纯绿，无旋转），内环左右两段分别在 40% / 80% 转纯绿；进度只统计叶子任务。
- **面板**：右缘可拖拽调宽（280–480，记 localStorage）；正文与面板固定 16px 缝隙。
- **布局**：右侧边栏打开时，对话与输入框夹在任务面板和右侧边栏之间（左右各 16px 缝隙，内容宽随剩余空间自适应）；右侧边栏关闭时对话与输入框回到宿主默认布局，面板浮在左侧不改动对话。
- **欢迎页**：新会话的欢迎页**不带**面板（该槽只对已进入的会话渲染），发出第一条消息后才出现。
- **启停**：一个切换按钮——运行时显示 ⏸（点它暂停），暂停时显示 ▶（点它恢复），两个图标用 90° 旋转 + 缩放交叉淡入做变形衔接。头部的是全局开关（暂停**未完成**的任务）；父任务行操作组最左侧的只作用于该父任务下的子任务。暂停不改四态，行置灰、标题划线；agent 读清单时会看到 `(paused)` 标记。
- **防走神三件套**：阻塞标记（环上红点角标，备注写原因）、焦点（钉住一个任务，每会话一个）、新条目入场（从左滑入 + 圆环转一圈）。
- **结构提示（0.3.4）**：agent 一次新增 >3 个顶层任务且都没挂子任务时，`task_write` 返回末尾带 `(warning: N new top-level tasks without subtasks …)`；只提示、不拒绝。
- **废弃与统计（0.3.5）**：题头进度环只统计未废弃的叶子任务；agent 读清单时废弃项单独成段 `Abandoned (N):`，标题行写成 `Task list (done/total done, K abandoned)`。

## 安装

插件目录本身就是一个 bundle（`package.json` 里有 `dsh.bundle.patch` 与 `dsh.client`）。

```
plugin_manager -> action: install_bundle -> target: <本目录>
```

本机已装，profile 里记录为：

```
"@local/dsh-task-list": "link:F:/DSH/projects/DSH任务系统重建计划"
```

目录是 link 安装：**改源文件即改运行文件**，不需要重新打包或复制。

## 卸载

```
plugin_manager -> action: remove_bundle -> target: @local/dsh-task-list
```

## 文件清单

| 文件 | 作用 |
|---|---|
| `package.json` | bundle 清单：`dsh.bundle.patch` + `dsh.client`（web / immediately / inject layout+conversation） |
| `cordis.patch.yml` | insert 行 `id: task-list` |
| `index.js` | Host 半：HTTP 路由 `/task-list/api/tasks`、`task_list` / `task_edit` / `task_write` 工具、fork 复制监听、结构 warning 文本 |
| `client.js` | 全部 UI：portal 到对话 body、viewArea 占位、分组/状态/拖拽/进度环、新建与备注编辑、数据对接 |
| `lib/task-file.js` | 落盘：`~/.dsh/storages/task-list/<sessionId>.json`，原子写、损坏备份重建 |
| `lib/task-store.js` | 合并规则纯函数（创建 / 本地 patch / agent 整表合并 / 删除 / 焦点 / 启停 / 阻塞级联 / 推导状态 / 同级移动 / 旧 todo 导入 / 结构统计） |
| `lib/task-store.test.js` | 53 条单测（node:test） |
| `locale/zh.json`、`locale/en.json` | 插件显示名与描述 |
| `icon.svg` | 青绿底清单图标 |
| `HANDOFF-任务列表_2026-10-29.md` | 项目交接文档（含 15 项后端决策与历轮踩坑） |
| `SHA256SUMS.txt` | 本包源文件哈希清单 |

## 验证

1. 语法（PATH 里没有 node，用 DSH runtime 的绝对路径）：
   ```
   C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe --check index.js
   C:\...\node.exe --check client.js
   ```
2. 单测：
   ```
   C:\...\node.exe --test lib/task-store.test.js   → 53 passed
   ```
3. 注册：`cordis_inspect_query` client `Slots.listSubTree` root `conversation.input.dock`，
   occupant `task-list.panel` 应为 `active: true`。
4. 工具：`cordis_inspect_query` host `Tool.listTools` 里应有 `task_list` / `task_edit` / `task_write`，
   `parameters` 必须是 `type: "object"`（否则模型 API 会拒收整轮请求）。
5. 接口：`GET /task-list/api/tasks?sessionId=<id>` 返回 `{"ok":true,"tasks":[...]}`。
6. 页面：面板出现在对话区左侧，四节结构完整，点环/拖拽能切状态，父环随子任务联动。
7. 结构：提交 4 个无子任务的新顶层 → 返回文本含 `(warning: 4 new top-level tasks without subtasks …)`，任务仍写入。

## 已知限制

- `todo_write` 已在 profile patch 里彻底禁用（覆盖 `preset-standard` 声明，把 `tool-todo` 置 `disabled: true`）：
  新会话的工具清单里只有 `task_list` / `task_edit` / `task_write`，输入框上方的 todo 进度条随之消失。
  已有会话和它的子会话沿用启动时的修订，所以老会话里仍会看到 `todo_write`，这是正常行为。
- agent 写入后面板**会在 1.5 秒内自动刷新**（Host 文件 `updatedAt` 变了才拉整表）；标签页隐藏时暂停轮询，本地写入与行内编辑期间不打断。
- 面板宽度存在浏览器 localStorage，不随数据走（决策 #9）。
- 旧会话的历史 todo 不导入（决策 #11，`importLegacyTodos` 保留但默认不跑）。
- 行内 8 个操作按钮的密度待视觉确认。
- 结构 warning 只统计**本次新增**的顶层任务，不追溯历史平铺；`strict` 模式与 `allowFlat` 逃生参数未实现（第二阶段）。

## 备份

- 母版：`F:\DSH\projects\DSH任务系统重建计划\`
- 交付包：`F:\DSH\导出\DSH任务系统重建计划_2026-11-07_v0.3.19.zip`
