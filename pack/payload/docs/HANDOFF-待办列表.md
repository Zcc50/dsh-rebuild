# HANDOFF：抱怨先生的待办列表

> 项目名：基于移动硬盘的本地多端PC待办 | 简称/应用名：抱怨先生的待办列表
> 创建：2026-10-31（自「双端待办」评估项目分离）
> 状态：**M1 已交付**；**M2 批 1 已实现、待验收**；M2 批 2 动画 / M3 备份转移 / M4 打包未开始
> 技术栈：Electron 45 + Vite 8 + React 19（主进程 CJS）

## 0. 新会话快速接入（接手开发先读这节）

- **2026-11-05 起主形态改为 DSH 插件**（右侧边栏 tab，工程在 `plugin/`，见 §10）；Electron 版冻结，不再扩展新功能，仅作为同一份 `tasks.json` 的另一读法保留。
- **当前状态（2026-10-31）**：**M1、M2 批 1、M2 批 2、M3 全部验收通过**（含目录设置 / 盘识别 / TODO 文件夹 / 自动备份 / 导出 / 启动盘检查 / 差异裁决）。界面配色已按用户选的方案 A 对齐 DSH（`#f9fafb` 底、4%/10% 黑边框、冷调阴影），**侧栏分类/分组的滑入滑出动画已按用户要求回滚**（恢复为无自定义动画）。**M4 打包未开始**：图标已生成 `build/icon.ico`，electron-builder 未安装，`node_modules` 已重建。构建 `index-ChsDetBS.js`。
- **跑起来**：双击 `start.bat`（依赖已装；重装用 §4 的 pnpm 命令）；改前端后先 `build` 再启动或 reload。调试版用 `start-cdp.bat`（同 start.bat 加 `--remote-debugging-port=9222`），已在跑的窗口可用 `window.todo.reloadWindow()` 热重载 dist，不必杀进程。
- **验证**：`node --test src/core/task-store.test.js` → 57 passed；UI 验证脚本在 `F:\DSH\temp\`：`sd-check2.mjs`（旧）、`sd-check20/21/22.mjs`（分类树与环）、`sd-reload.mjs`（热重载）。
- **数据**：`%APPDATA%\mr-baoyuan-todo\tasks.json`，备份在 `backups\`（保留 10 份）；旧版 `shuangduan-todo` 数据已自动迁移。
- **必读**：§6 踩坑（`ELECTRON_RUN_AS_NODE`、无沙箱、ESM 主进程、CIM 中文路径、CDP 耐心等待、hover 验证）。
- **下一步**：用户复看 M2 批 2 收尾（展开闪烁 / 折叠弹跳 / dock 对齐）→ 通过后 M3 备份转移 → M4 打包。参考源码 `F:\DSH\projects\DSH任务系统重建计划\client.js`（动画见 1864–1885 FLIP、2001–2031 折叠、2494–2553 dock）。

## 1. 目标与范围

做一个**只在 Windows 本地运行**的待办清单：

- 用户自己编排任务：父子两层、五态（待办/进行中/待确认/完成/废弃）、优先级、备注、阻塞、焦点、暂停；
- 数据是**单个 JSON 文件**，可通过移动硬盘**备份**、在**多台 PC 之间转移**（导出/导入按 rev 合并）；
- 不做局域网、不做手机端、不依赖云与账号；
- UI 参照 `F:\DSH\projects\DSH任务系统重建计划`（DSH 任务列表面板插件）的成熟样式与交互，逐步 1:1 复刻。

## 2. 现状（M1 已验证）

- 窗口可启动，标题「抱怨先生的待办列表」；
- 建任务 → 落盘 → 列表刷新 → 删除，全链路经 CDP 自动化验证；
- `tasks.json` 原子写（临时文件 + rename），损坏时自动备份为 `.corrupt-<ts>`；
- 手动备份到 `%APPDATA%\mr-baoyuan-todo\backups\`，保留最近 10 份；
- 数据层 `src/core/task-store.js` 从参考实现整份复制，**49 条单测全过**；
- 旧版 `shuangduan-todo` 的数据在首次启动时自动迁移。

## 3. 文件地图

```
F:\DSH\projects\抱怨先生的待办列表\
  package.json               工程清单（name mr-baoyuan-todo / productName 抱怨先生的待办列表）
  vite.config.js             base './'，outDir dist
  index.html                 React 入口
  start.bat                  开发版启动（清 ELECTRON_RUN_AS_NODE + --no-sandbox）
  start-cdp.bat              同上 + --remote-debugging-port=9222（CDP 验证用）
  electron\main.cjs          主进程：窗口 / IPC / tasks.json 原子写 / 备份 / 旧数据迁移 / config.json 目录设置
  electron\preload.cjs       contextBridge → window.todo { load, save, backup, info, getConfig, pickDir, setDir, toggleDevTools, reloadWindow }
  src\main.jsx               React 挂载
  src\App.jsx                入口，挂载 src\ui\TaskPanel
  src\ui\TaskPanel.jsx       整页面板：左栏分类树（全部→每日/每月/限时/无限→分组）、主区列表、完成/废弃 dock、设置
  src\ui\TaskRow.jsx         任务行（head/card/abandoned 三种形态）
  src\ui\TaskMarker.jsx      状态环（两段过渡 + 三层折叠箭头；color 参数供侧栏分类环复用）
  src\ui\TaskProgressRing.jsx 头部完成度环
  src\ui\styles.css          参考实现样式全量迁移 + 侧栏分类树/分组/设置样式
  src\core\task-store.js     任务纯逻辑（分类字段、migrateTasks、refreshRecurring）
  src\core\task-store.test.js  57 条单测
  dist\                      vite build 产物（Electron 加载）
  README.md                  使用与开发说明（仍停在 M1 口径，待更新）
```

## 4. 开发命令

```powershell
# 依赖（已装好，重装才需要）
C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe `
  C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs install

# 构建 + 启动（开发版）
node_modules\vite\bin\vite.js build
start.bat        # 或：清掉 ELECTRON_RUN_AS_NODE 后 electron.exe . --no-sandbox

# 单测
node --test src/core/task-store.test.js     # 49 passed
```

## 5. 数据与备份设计

- 数据：`%APPDATA%\mr-baoyuan-todo\tasks.json`，结构 `{ version, deviceId, tasks, updatedAt }`。
- 备份：`%APPDATA%\mr-baoyuan-todo\backups\tasks-<ISO>.json`，保留 10 份（`BACKUP_KEEP`）。
- 迁移（M3 待做）：导出 `tasks.export.json`（含 `deviceId` + 每任务 `rev`），另一台机器导入时按**任务级 rev 后写胜**合并（复用 `task-store.js` 的 `mergeAgent` 语义），落败方提示「已被其他设备更新」一次。

## 6. 踩坑（DSH 环境下调试时）

1. **`ELECTRON_RUN_AS_NODE=1`**：DSH 环境自带，会让 electron.exe 以纯 Node 跑（`app` undefined）。启动前必须清除；`start.bat` 已处理。用户双击安装版不受影响。
2. **Electron 45 ESM 主进程不可靠**：`import { app } from 'electron'` 报 "does not provide an export"；主进程用 `.cjs` + `require`。
3. **本机无沙箱权限**：不带 `--no-sandbox` 启动即崩（exit 0x80000003）。
4. **CIM 启动中文路径失败**（`Error launching app at system32`）：自动化启动用绝对路径 + 系统编码要注意；日常用 `start.bat`。
5. 验证 UI 用 CDP（`--remote-debugging-port=9222` + Node 内置 WebSocket），脚本在 `F:\DSH\temp\sd-check20/21/22.mjs`。
6. **CDP 别查太早**：electron 从进程出现到 `/json` 可连有 1–3 秒延迟；重启后先等 2–3 秒，否则会把正常启动误判成「启动失败」。
7. **启动命令会挂住**：pwsh 里 `Start-Process` 或 `[Diagnostics.Process]::Start` 启动 electron，工具调用会因继承管道一直挂着；用 `cmd /c "start ..."`（start.bat 的方式）或后台 job。
8. **hover 验证要等**：`Input.dispatchMouseEvent` 移入后 300ms 内读 `getComputedStyle` 还是过渡起点（identity），会误判规则没生效；等 ~800ms 再读。
9. **热重载**：`window.todo.reloadWindow()` 直接加载新 dist，不用杀进程；reload 后旧 WebSocket 的 evaluate 上下文会丢，重新连。
10. **验证脚本别碰真实数据**：`window.todo.save([])` 会直接清空用户正在用的 `tasks.json`（2026-10-31 清过一次，当时全是测试数据没损失）。要造/清数据先 `window.todo.backup()`，或起隔离实例（`--user-data-dir=...`）；也别在用户操作时跑脚本，状态会被两边同时改。
11. **`element.click()` 不等于真鼠标**：它不产生 mousePressed/mouseReleased，`onMouseDown.preventDefault()` 这类"阻止输入框失焦"的防护就不生效，验证结论会和真人操作不一致（2026-10-31 测「取消」按钮就因此误判过一次）。测交互一律用 `Input.dispatchMouseEvent` 发 mousePressed / mouseReleased。
12. **跨容器换节的行会重建 DOM 节点**：子任务从一节拖到另一节时 React 重建行，旧 rect 与新节点对不上，FLIP（内联 transform+rAF 或 WAAPI 都试过）不稳定。结论：换节用「落位动画」（`.dstl-row-jump`）而不是 FLIP；FLIP 只用于同容器内的拖拽让位。
13. **状态变化动画的状态要同步记录**：`prevStatus` 若在 `useEffect` 里补，effect 运行时行已挂载完，环拿不到旧色。必须在 `cycle()` / `commitPreview()` 这类操作入口同步 `markStatusChange(id, old)`。

## 7. 剩余工作清单（2026-10-31 与用户确认）

> 实况基线（2026-10-31 14:20）：M2 批 1 **已验收通过**（`src/ui/*`，`App.jsx` 只挂载 `TaskPanel`）；`task-store` **57 单测通过**；dist 与源码同步（`index-DCHrpbdi.js`）；数据 `tasks.json` **0 条**（测试残留已清，清前自动备份两份）。
> 进度：M2 批 1 完成；M2 批 2 动画、M3、M4 未开始。
> 档位决策：M2 **先静态功能、动画后补**（两批分开验收）。

### 7.0 规则决策（2026-10-31 用户逐项拍板）

| 分叉 | 定论 |
|---|---|
| 限时任务到期 | **状态不变**；行上标红并显示「已超 N 天」，由用户决定完成还是改期 |
| 每日/每月刷新 | **重置回待办** + 记 `lastCompletedAt`，行上显「上次完成 10-30」；**不**复制新任务 |
| 分类与父子层级 | **父定子继承**：`category`/`deadline` 只存在顶层任务，子任务读取时跟随父（UI 置灰） |
| 项目结束后备份盘不在线 | 提示「备份盘未连接，已使用本地数据」后**正常进入**，不阻挡使用 |
| 差异裁决粒度 | **整条任务二选一**（用本地 / 用备份），不做字段级合并；支持全部用本地/全部用备份 |
| 拖拽调宽 | **不做**（2026-10-31 砍：整页布局下拖面板宽无意义） |
| 优先级 UI | **不做**（2026-10-31 砍：store 字段保留不动，界面不暴露） |

数据模型增量（M2 批 1 落地）：
- `category ∈ {daily, monthly, deadline, null}`，仅顶层任务存；「全部」是视图筛选，不落字段
- `deadline`：ISO 日期（`YYYY-MM-DD`），仅 `category === 'deadline'` 的顶层任务有
- `lastCompletedAt`：毫秒时间戳，用于「上次完成」展示与跨周期判定

### M2 批 1 · 静态功能（先做）

1. 组件拆分到 `src/ui/`：`TaskMarker` / `TaskRow` / `StatusSection` / `TaskPanelHost`（参考 `client.js` 958 / 1164 / 1454 / 1496 行）
2. 样式迁移到 `src/ui/styles.css`：`client.js:226` 起的 `.dstl-*` 样式表（约 237 条压缩规则，只吃 `--dsw-*` 变量且带十六进制 fallback；`src` 侧 `:root` 补一小组默认值）
3. 五态齐活：pending / in_progress / review / completed / **abandoned**（现有 App.jsx 只有前 4 态，且缺撤销废弃）
4. 字段接入：优先级（high/medium/low）、备注、阻塞（task / subtree 两种范围）、焦点置顶、暂停
5. 交互：行内改标题、上移/下移（`moveSibling`）、删除、新增子任务
6. 按状态分节 + 折叠（`collapsedParents` / `buildList` 语义）
7. 拖拽调宽 + 宽度记忆（`clampWidth` / `readStoredWidth` / `storeWidth`，localStorage）
8. 修标题：`App.jsx` 的 h1「双端待办」→「抱怨先生的待办列表」
9. 数据层对接：现 App.jsx 只 import 了 `insertTask / setStatus / removeTask / deriveStatus / nextOrder`；store 已有 `patchList / setFocus / setPaused / setBlocked / moveSibling / removeSubtree / importLegacyTodos` 可直接接
10. **分类字段**（新需求）：`category` + `deadline` 仅顶层任务存，子任务继承父；扩展 `task-store` 校验与单测
11. **四分类筛选**（新需求）：顶部「全部 / 每日 / 每月 / 限时」切换，全部=不筛；先筛分类、后按状态分节
12. **建任务选类**（新需求）：新建表单可选分类，选「限时」需填截止日期
13. **周期刷新**（新需求）：每日跨天 / 每月跨月 → 重置回待办并记 `lastCompletedAt`；限时到期标红显「已超 N 天」，状态不变
14. **旧数据迁移**（新需求）：旧 `tasks.json` 无新字段 → 读取时补 `null`，不报错不丢任务

### M2 批 2 · 动画（后补）

15. 状态环两段过渡（`ringColor` / `TaskProgressRing`）
16. 换节 FLIP 动画
17. 折叠/展开动画

### M3 · 备份与转移

18. 备份目录选择：移动硬盘按**卷序列号**识别 + 存相对路径（防盘符漂移）
19. 自动备份：启动 / 退出 / 定时，策略可配（现在写死 `BACKUP_KEEP = 10`）
20. 导出 `tasks.export.json`（含 `deviceId` + 每任务 `rev`）
21. **启动盘检查**（新需求）：启动时探测指定备份盘是否在线；不在线＝提示一句后继续用本地、不阻挡；在线＝读快照与本地按 id+rev 比对出差异清单
22. **差异裁决**（新需求，替代原「rev 后写胜自动合并」）：差异逐条列（新增/修改/删除/双边改动），每条选「用本地 / 用备份」，支持全部用本地/全部用备份；不做字段级合并

### M4 · 打包

23. electron-builder：NSIS 安装包 + 便携 zip
24. `icon.ico` + 开始菜单快捷方式
25. **托盘常驻**（新需求）：关闭键 → 隐藏到托盘不退出；托盘左键显示/隐藏，右键「显示 / 退出」；首次关闭提示一句
26. **开机自启**（新需求）：写 `HKCU\...\Run` 或启动文件夹，自启后静默进托盘；设置里可开关，卸载时清理
27. 安装版冒烟：安装 → 启动 → 建任务 → 关闭进托盘 → 托盘退出再启动数据在 → 卸载不丢数据

### 顺带清理（已知小问题）

28. `electron/main.cjs` 的 `validate` 与 `task-store.assertValidTree` 逻辑重复，且不校验 status 枚举与「仅两层」限制 → 考虑复用 store 的校验
29. ~~`README.md` 仍停在 M1 口径~~ → 已补，2026-10-31 对齐 M2 批 1
30. 窗口尺寸/位置不记忆（可选，不阻塞交付）

## 11.1 一句话现状

`抱怨先生的待办列表` 已从 Electron 独立软件转为 **DSH 右侧栏插件**，已跑通并验收（数据、面板、备份、工具都正常）。本工程确定项已于 2026-11-05 全部验收（互斥、两步切换、分类栏 208、清空数据、打包）；仅 §10.7 的 3 条暂缺仍未排期，见 §11.5。

## 11.2 工程位置

```
F:\DSH\projects\抱怨先生的待办列表\
  src\ electron\ dist\ release\   Electron 版，**冻结**，不再扩展（M4 已出包）
  plugin\                         当前唯一维护目标
    package.json        @local/dsh-todo-list，dsh.bundle.patch + dsh.client
    cordis.patch.yml    insert 一行 todo-list
    index.js            Host 半：目录解析 / 原子写 / 备份 / 导出 / 差异裁决 / HTTP / 3 个工具
    client.js           构建产物（147116 B，勿手改）
    build.mjs           rolldown 打包（项目无 esbuild）
    lib\task-store.js   纯逻辑副本
    src\client\index.jsx   插件接线（175 行）
    src\client\todo-api.js window.todo.* 的 HTTP 替身
    src\ui\*            TaskPanel / TaskRow / TaskMarker / TaskProgressRing / styles.css
    locale\ icon.svg
```

安装方式：`plugin_manager install_bundle` 指向 `plugin\`（已装，link 模式）。**改 client 或 Host 都要重启 DSH 才生效**。

## 11.3 当前生效的行为（已验收）

| 项 | 行为 |
|---|---|
| 入口 | 会话头部一个勾选图标（`todo-list-entry`），点了开/关待办页 |
| 打开方式 | `openTab(kind, { replaceTab, preferNewPane:false, revealIfOpened:true })`——顶掉右栏现有页，不并排 |
| 待办按钮 | toggle：已开就 `close`，没开就打开 |
| 侧边栏按钮 | 只开关右栏；待办 tab **保留**，收起只是看不见，再展开原样回来（**不要**再加「收起即关 tab」） |
| 数据 | 共用 `%APPDATA%\mr-baoyuan-todo\TODO\tasks.json`，与桌面版同一份 |
| agent 工具 | `todo_list` / `todo_add` / `todo_update`（与 `task_list/task_write` 完全不同一套） |
| 废弃 | 点垃圾桶第一下进入 4 秒确认（红底 + 倒计时环 + 勾），第二下才生效；`Shift+点击`直接彻底删除 |
| 四态循环 | 无子任务的顶层点环轮转；有子任务的点环折叠；跨节拖拽才播落位动画 |
| 样式 | 全部作用域在 `.dstl-app` 内，不碰 `:root/body/*` |

## 11.4 已知事实与限制（别再踩）

- **右侧栏 tab 严格 session-scoped**，没有会话就 `openTab` 抛错；参数存在 `tab.navigation.params`，**不落盘**。
- `ctx.layout` **没有宽度 setter**，布局宽度不持久化（左栏初始 280、右栏视口 45%）。用户已决定不修（§10.13）。
- 已安装包改代码返回 `{code:"already-installed"}` 是正常的，link 模式无需重装。
- 构建必须用 `build.mjs`（rolldown 在项目 `node_modules/.pnpm/rolldown@1.2.16`），项目里**没有 esbuild**。
- asar 内源码只有 `read` 工具能穿透，shell/glob/grep 都不行。
- `task_write` 的 `paused` 字段已加（`DSH任务系统重建计划`），但**需重启 DSH 才生效**；未生效时传了会被静默忽略。
