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

## 8. 日志

- 2026-10-31：从评估项目「双端待办」分离；工程迁移到本目录，package name → `mr-baoyuan-todo`，productName/窗口标题 →「抱怨先生的待办列表」；旧 userData 自动迁移；构建通过、窗口与 2 条旧任务验证通过。
- 2026-10-31：新会话接入核对（只读）：目录 15 个源文件、`dist` 与源码同步（11:35 构建）、`task-store` 49 单测通过、`tasks.json` 2 条测试任务、无 `backups` 目录（从未手动备份过）。确认 M1 结论成立，剩余 = M2/M3/M4 + 3 项顺带清理。用户选择「只确认清单，暂不动手」，M2 档位定为「先静态功能，动画后补」；清单落入 §7 待下次开工。
- 2026-10-31：用户追加 4 条需求（托盘常驻 / 四分类+时间刷新 / 开机自启 / 启动盘检查+差异裁决），已拆为 9 个子任务并入 M2 批 1、M3、M4，原「用户额外需求」父任务与 4 个子任务置 abandoned 留痕。同轮用户逐项拍板 5 条规则（限时到期标红不改状态、每日每月重置回待办记 lastCompletedAt、分类父定子继承、盘离线提示后继续、差异整条二选一），已记入 §7.0 数据模型增量。清单 9 项 → 30 项。
- 2026-10-31：**M2 批 1 首版落地**。新增 `src/ui/`：`styles.css`（参考 client.js 227-398 样式表全量迁移，`.dstl-panel` 改整页 `.dstl-app`，补 `:root` 变量与分类/标签页/输入区样式）、`TaskMarker.jsx`、`TaskProgressRing.jsx`、`TaskRow.jsx`、`TaskPanel.jsx`；`App.jsx` 缩为挂载入口；`main.jsx` 改引 `./ui/styles.css`。`task-store.js` 增 `CATEGORIES` 常量与 `category`/`deadline`/`lastCompletedAt` 三字段、`refreshRecurring`、`migrateTasks`，单测 49 → **56 全过**；`vite build` 通过（CSS 18.3KB / JS 249KB）。CDP 验证：标题正确、四 tab 与计数、建任务、点环 pending→in_progress、切「每日」tab 只显该分类、废弃 dock 与恢复入口均在。**遗留**：拖拽调宽含义待定（整页布局下拖窗口 vs 面板宽）、优先级 UI 未暴露、动画属批 2。
- 2026-10-31：按用户要求**砍掉阻塞标记与置顶标记**（菜单只剩分类/截止日/分组/重命名），优先级 UI 也不暴露。**新增加**两类交互：①行内切类——菜单四选一（无分类/每日/每月/限时），仅顶层可改，切「限时」默认 7 天后并可在行内改日期；②自定义分组名——`task.group` 字段 + 菜单「设置分组…」行内输入，每日/每月/限时三个 tab 下出二级页签（全部 + 该分类下出现过的组名，空组归「未分组」），纯展示分组不改语义。store 增 `group` 校验与 `migrateTasks` 补齐，单测 **49 → 57 全过**。CDP 隔离实例（`--user-data-dir`）7 项断言全 PASS：每日页签 = 全部/工作/生活/未分组、点「工作」只剩对应任务、每月页签只含该月下出现过的组、切分类自动回到「全部」。
- 2026-10-31：按截图对齐参考实现的**分节结构**（用户指出「界面还没完全同步」）。三处修正：①四个状态节全部渲染，空节为虚线空框（原来只渲染有内容的节）；②顶层已完成任务移出活列表，进底部可折叠的「已完成」区（新增 `m2a-dock`）；③折叠箭头画进状态环——`TaskMarker` 加 `arrow`/`open` 两参数，移植参考实现的三层箭头（收起向上、展开向下、悬停向右），父行点环=折叠而不是改状态（新增 `m2a-arrow`）。隔离实例 6 项断言全 PASS：四节渲染、2 个空格、完成任务进 dock、活列表不含完成项、环内有箭头、点环 4→2 行且父状态仍为 pending。
- 2026-10-31：**配色改从皮肤实际设置取**（用户指出此前读的是默认 fallback）。真实主题在 `C:\Users\Administrator\.dsh\profiles\desktop\cordis.patch.yml` 的 `ui-skin-claude-style` 节点：`brand: deepseek` / `palette: claude` / `customAccent: "#3749a4"`。据此状态环与全部 brand 相关控件改为 `#3749a4`（原来是 claude 默认橙 `#d97757`），pending 灰改用 deepseek palette 的 `#848891`（原 `#a39d92`）；`styles.css` 的 `:root` 同步换成这套解析值。实测：`--dsw-alias-brand-primary` = `#3749a4`、tab 选中背景 `rgb(55,73,164)`、环 stroke `#848891`。review 黄（`#d98e2b`）与 abandoned 红（`#d8473a`）皮肤未覆盖，沿用 host 默认。
- 2026-10-31：同轮还改了头部：新建入口从列表上方的常驻输入行改为头部 `+` 按钮（在备份按钮左侧），点开才出输入行；删掉头部重复的 `0/N` 计数；`全部` tab 下不再显示每日/每月/限时徽章；无子任务的独立任务补上 `+` 加子任务按钮（点后原地变父容器并出输入框）。9 项 CDP 断言全 PASS。

- 2026-10-31：**新建方式与废弃区按参考实现对齐**。新建：去掉独立 composer 行，头部 `+` 与行内 `+` 都改为「立即插入一条标题为『新任务』的行并进入重命名态（输入框自动聚焦全选）」，回车确认标题、Esc 取消——对应参考实现 `createAndRename(parentId)`（client.js:2114，`CREATE_TITLE = '新任务'`，order 用 `nextOrder`）。废弃区：头部从裸按钮改为 `.dstl-row.dstl-row-head.dstl-abandoned-head`（红环 + 三层折叠箭头 + 名称 + 计数），默认折叠、点击展开，空时显示「没有废弃的任务」；完成区同构（绿环 + 箭头 + 计数），默认折叠、点击展开。验证（隔离实例，精确选择器）：新建父/子任务均 PASS（`hasRenamingRow:true, value:'新任务'`、提交后落盘 parentId 正确）；两端 dock 头部结构 `isRowHead:true, hasRing:true, hasArrow:true`；废弃区 0→1、完成区 0→1→0 折叠切换 PASS。
- 2026-10-31：按用户「完成那些已经确认过的任务」把 8 项已确认子任务置 completed：拆组件之外的 create（建任务方式）、section（状态分节）、dock（完成区）、arrow（环上折叠）、head（头部精简）、plus（独立任务加子）、color（状态配色）、title（修标题）；M2 批 1 其余项仍待验收。
- 2026-10-31：**布局改为左右两栏**（用户要求：黑框菜单栏删掉、红框分类改纵向、备份与设置并进左栏）。①`electron/main.cjs` 加 `Menu.setApplicationMenu(null)`，去掉 File/Edit/View/Window；开发者工具与重新加载改成 IPC `todo:devtools` / `todo:reload`，收进左栏「设置」弹层。②`TaskPanel` 外壳从单列改 `.dstl-app` 横向 flex：左 `.dstl-sidebar`（156px，含进度环+「待办列表」、纵向「全部/每日/每月/限时」带计数、底部「备份数据」「设置」），右 `.dstl-main`（标题+新建、分组二级页签、列表、两个 dock、footer）。③新建父任务仍用 `nextOrder` 追加到末尾（右侧补位）。实测：侧栏 x=1/w=156、主区 x=157/w=806、纵向四分类、设置弹层两项、点备份生成 `backups\tasks-<ISO>.json`。
- 2026-10-31：**左栏改分类树 + 目录设置**。①新增 `CategoryRing.jsx`（彩色圆环 + 可选折叠箭头）；②侧栏从平铺四个按钮改树：`全部` 为根行（环带箭头，点环只折叠子分类、右侧不动），`每日/每月/限时/无限` 四个子行缩进 28px 挂在虚线左侧栏下；点"全部"显全部任务、点子类只显该分类；③**无限 = 无分类**（`category` 为空的任务），计数与筛选都走这个口径；④环色按用户拍板方案 A：全部 `#1f1f1f`、每日 `#7bbf7b`、每月 `#e2c65c`、限时 `#c0392b`、无限 `#b9b2a6`；⑤设置弹层加「本机目录」「备份目录」两行（显示当前路径 + 更改按钮）：`electron/main.cjs` 新增 `config.json`（固定存 `%APPDATA%\mr-baoyuan-todo\`，即使数据目录搬到别的盘也找得到），`dataDir`/`backupsDir` 改为先读配置，IPC `todo:getConfig` / `todo:pickDir`（`dialog.showOpenDialog` 选目录）/ `todo:setDir`；本机目录改动重启生效、备份目录即时生效。
- 2026-10-31：实测（CDP）：侧栏 5 行 `["全部","每日","每月","限时","无限"]`，计数 `3/1/0/0/2`，环色逐行与方案 A 一致；点"全部"环后侧栏由 5 行变 1 行（只折子分类）；点"无限"后 active=无限、右侧只剩无分类任务；设置弹层读到「本机目录 `...\mr-baoyuan-todo`」「备份目录 `...\mr-baoyuan-todo\backups`」及各自「更改」按钮。
- 2026-10-31：**侧栏样式两轮修正 + 交接**。①分类环改为复用父任务环：`TaskMarker` 增加 `color` 覆盖参数，分类树不再用独立的 `CategoryRing`（该文件已删）；根环 40×34 三层箭头、子环 20×20 双弧，与任务行完全同构。②删掉侧栏顶部「待办列表」整行（进度环+文字），「全部」直接置顶；主区头部仍保留进度环+标题+新建。③子分类先试过"框内列表"（`dstl-section-box` 式），用户要求回滚为**独立行**：当前是每行一条圆角、hover 浅底、选中整行蓝底，左侧虚线缩进 14px 挂在「全部」下。**本会话到此交接**，下一步见 §7 与任务表（M2 批 2 动画、M3 备份、M4 打包均未开始）。
- 2026-10-31（新会话）：**左侧分类树加第三层分组**。用户确认方案 A：左侧唯一入口，第三层只列各组 + 未分组（不含「全部」）。`TaskPanel.jsx` 新增 `groupsByCategory`（按分类聚合组名与计数）、`selectCategory`（选中并自动展开）、`toggleCategory`、`selectGroup`；点分类名选中，行尾三角展开/收起，点组名筛选；主区顶部二级页签 `dstl-subtabs` 及其 CSS 全部删除。`styles.css` 新增 `.dstl-side-branch` / `.dstl-side-groups` / `.dstl-side-group-row` 等。构建通过。
- 2026-10-31：**左侧环动画与父任务同步**（用户定调：除颜色外全复用）。四个子分类环从 20×20 普通环换成父任务同款：`<TaskMarker status="pending" color={分类色} arrow open={expanded} />`（40×34、三层箭头、open 随展开旋转）；`TaskMarker.jsx` 一行未改，动画参数原样沿用；点环=展开/收起分组，点名字=选中；颜色保持第④条方案 A 的分类色。随后补 hover 向右动画：4 条规则与父任务逐字一致（`rotate(90deg)` / `scale(1.9)` / `scaleY(.55)` / mini `opacity:1`），只把父任务的 `.dstl-row:hover .dstl-status` 换成 `.dstl-side-row:hover .dstl-side-ring-btn`。
- 2026-10-31：**「不缩小」改动被回滚**。用户指出箭头向右时不应缩小 → 删掉 scale/squash 两条 hover 规则并重建；用户随即要求回滚 → `undo_last_edit` 恢复 4 条规则，重新 build 并 reload。**当前界面是含缩放的版本**（dist `index-BzscK81s.css`），若确认不要缩放，再单独删那两条规则即可。
- 2026-10-31 验证数据：子分类环 40×34、`arrow:true`、颜色 `#7bbf7b / #e2c65c / #c0392b / #b9b2a6`；hover 时 computed：`matrix(0,1,-1,0,0,0)`、scale 1.9、squash 0.55、mini opacity 1；`task-store` 57 单测通过；应用用 `start-cdp.bat` 启动、CDP 9222 可用。备注：点「每日」列表为空是因其唯一顶层任务被派生为 completed 进了「已完成」dock（`deriveStatus` 既有语义），不是本轮改动引入。

## 9. 前端沟通协议（改 UI 前先看）

改本项目界面时按 `F:\DSH\projects\前端优化\前端沟通协议.md` 执行，要点：

- 用户描述前端需求只给「哪块 + 往哪变」，DSH 负责翻成类名 + 数值；改动前出回执，给 2–3 个带数值的候选，用户回字母。
- 定位用锚点词表（顶栏 / 分类标签 / 任务行 / 状态环 / 备注 / 废弃区 …），不靠「红框 / 黑框」这种截图指代。
- 参数基准：字号档 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 15 / 16；「一点」= 字号 0.5、间距 2px、行高 1px。
- 改完必须报账（改动 / 连带 / 影响 / 验证），用户说「过」才算验收。

- 2026-10-31：**批 1 验收通过 + 分类新建 bug 修复**。用户回「过」结 M2 批 1；随后报「分类下新建任务无法正确显示，只出现在全部」。根因：`TaskPanel.startCreate` 建行时只写 `id/title/status/origin/parentId/order`，**没写 `category`**，新任务一律 null → 只落「全部」。修复：按当前 `filter` 写入——`daily`/`monthly` 直接对应，`deadline` 带默认 7 天后日期（与行内切类 `setCategoryOf` 同口径），`infinite` 写 null；再把当前 `groupFilter`（非「未分组」）写进 `group`。子任务仍不带类（父定子继承）。`vite build` 通过（`index-DCHrpbdi.js`）。CDP 验证：清空后「每日」新建 → 行立即出现 → 提交标题 → `cat=daily`，切「全部」在、切回「每日」也在；四分类落库分别为 daily / monthly / deadline(2026-11-07) / null。
- 2026-10-31：按用户「清、补」：①清空 20 条测试残留（114514/aaa/1111 等），清前 `window.todo.backup()` 两份（`tasks-2026-10-31T06-08-57-866Z.json`、`06-09-12-201Z.json`），现 `tasks.json` 0 条；②重写 `README.md` 对齐 M2 批 1（四分类口径、57 单测、目录结构、目录设置、`start-cdp.bat`、路线 M2 批 2 / M3 / M4）。任务表：批 1 四子项转 completed，新增「分类新建bug」「清理数据」两个父任务。
- 2026-10-31：**侧栏改版（用户 4 项）**。①去竖线：删 `.dstl-side-children` / `.dstl-side-groups` 的 `border-left:1px dashed`，缩进保留（margin 14px / 22px）；②去深蓝底：`.dstl-side-row.dstl-side-on` 背景改 transparent，label / count 回常色；③选中改箭头指示：新增 `.dstl-side-row.dstl-side-on .dstl-side-ring-btn .dstl-marker-arrow{transform:rotate(90deg)}`，普通行仍 0°/180°、hover 规则不变；④分类行计数左侧加 `.dstl-side-plus`（14px，常驻 opacity .45，hover 1），点击在该分类第三层出输入框（`.dstl-side-group-input`），回车登记**空组**，存 `localStorage['mr-baoyuan-extra-groups']`（形如 `{daily:["工作"]}`），与任务聚合的组同名合并、计数 0，点进是空列表——`startNewGroup` / `commitNewGroup` 在 `TaskPanel.jsx`；⑤侧栏 156 → **188px**。`vite build` 通过（`index-BfaFZc_g.js` / `B6beXiIa.css`）。CDP 断言：width 188、children border `0px none`、选中行 bg `rgba(0,0,0,0)`、选中箭头 `matrix(0,1,-1,0,0,0)`、+ 按钮 4 个、建「工作」后组行 `工作 0` 且 localStorage `{"daily":["工作"]}`、点该组列表为空（`empty:true`）。验收用的「工作」组已清掉。**注意**：空组只在 localStorage，不在 `tasks.json`，M3 多机转移不带走（后续要么并入数据文件，要么接受丢失）。
- 2026-10-31：**侧栏交互修正（用户报 2 项）**。①整行点击：根行 / 分类行从「点环=折叠、点名字=选中」改为**整行一个点击**——`clickRootRow`（toggle `treeOpen` + filter=all）、`clickCategoryRow`（选中 + toggle 第三层）；环与名字都改成 `<span>`（不再各自绑 onClick），行加 `role="button"` + Enter/Space 键处理，`+` 按钮 `stopPropagation` 保持独立；旧的 `selectCategory` / `toggleCategory` 已删。②选中箭头「静止在最大态」：`.dstl-side-row.dstl-side-on` 下补 `-scale scale(1.9)`、`-squash scaleY(.55)`、`-mini opacity:1` 三条，鼠标移开不缩小（与 hover 同值、无回弹）。CDP：点分类行 → 第三层开/合切换且选中跟手；点环坐标同样触发；鼠标移到 (5,5) 后 scale 仍 `matrix(1.9,0,0,1.9,0,0)`；点 `+` 不改变选中。构建 `index-DlXnEXTZ.js`。
- 2026-10-31：**分组行接入同一套环**。`TaskPanel` 分组行（`.dstl-side-group-row`）左侧加 `<span class="dstl-side-ring-btn"><TaskMarker status="pending" color={item.color} arrow open={false} /></span>`——颜色跟随所属分类，`open` 恒 false（分组无子级、不展开）；CSS 用 `width/height 30×26` 把 40×34 的环等比缩小；hover / 选中动画规则扩成 `.dstl-side-row` 与 `.dstl-side-group-row` 双选择器（右转 90°、scale 1.9、squash .55、mini 1）；`.dstl-side-group-row.dstl-side-on` 蓝底改 `transparent`，文字回 `#1f1f1f`、计数回灰。CDP：分组行 bg `rgba(0,0,0,0)`、arrow `matrix(0,1,-1,0,0,0)`、scale `matrix(1.9,…)`，鼠标移到 (5,5) 后保持；行内无子行。构建 `index--tomJqjL.js`。
- 2026-10-31：**任务行改版（用户 2 项）**。①新建行按钮：`TaskRow` 的 `.dstl-inline-form` 由单个「好」改为「确认」+「取消」，两个按钮加 `onMouseDown preventDefault` 防 blur 抢跑；`TaskPanel` 新增 `creatingId` 记录新建行，`cancelRename` 用函数式 `setTasks` 删掉占位任务并直接 `save`，`commitRename(blurOnly)` 对未命名的 `creatingId` 行也按取消处理（原来 Esc/取消只退出编辑，留一条「新任务」）。探针验证：真实鼠标点取消 `isNew:true`、`count 4→3`、磁盘同步 3。②分类标识：任务行去掉文字徽章（每日/每月/限时），改为 `CategoryRing`——直接复用 `TaskMarker` 双层环并传分类色（daily #7bbf7b / monthly #e2c65c / deadline #c0392b / infinite #b9b2a6），CSS 缩到 `18×18`（略小于 20 的状态环）；子任务经 `categoryOf()` 跟随父分类。实测 `.dstl-badge` 0 个、环 stroke `#7bbf7b`。构建 `index-DBFiKts8.js`。
- 2026-10-31：任务行改版**验收通过**。用户提「两个环与任务名要在同一水平线」，实测状态环 / 分类环 / 标题文字三者 `getBoundingClientRect` 的 cy 完全相同（71 / 136 / 302），确认为人眼视觉错觉，未改代码。任务表 41 条：完成 22、待验收 1（README）、未开始 18。
- 2026-10-31：**任务栏第二批 + 分组新建 + 拖拽重做**。①整行点击展开（去掉双击改名，父任务点整行/标题都展开，子任务点环仍循环状态）；②父任务行只留 废弃 / + / …，删暂停、上移、下移、备注；子任务删上下移，保留 备注 / … / 废弃；③「…」菜单只留 重命名 + 截止日期（分类、分组改拖拽），并修「点空白关不掉菜单」——`useEffect` 监听 `mousedown`，`ref.contains` 判外部；④左栏新建分组改用 `.dstl-inline-form` + 确认/取消，窄栏下 input 独占一行、按钮下排（`.dstl-side-group-new` 覆盖），取消不留空组；⑤**拖拽按工作区美化 §10.18/§10.19 口径重做**：删插入线，改实时重排预览（`preview:{parentId,status,ids}` 只改渲染）+ FLIP（`translateY` 回补、`.12s`）+ 滞回 `dropSide`（`min(6px, h*0.3)`）+ 命中用 `parent.rect.top + offsetTop` 避开 transform + 松手才 `persist` 写 order；拖到分类/分组行 = `dropOnCategory`/`dropOnGroup`（悬停容器淡背景 `.dstl-side-drop`，松手才写）。行加 `data-task-id` 便于定位。CDP 验证：预览顺序变化、drop 后 order 重排（11111111 o0→o1）、拖到「每月」→ category=monthly、高亮 1 个。**坑**：预览只含同 status 的行，`orderedRoots` 若要求长度等于整个可见列表会整段回退，改为只重排同 status 槽位。
- 2026-10-31：**「全部」去掉折叠**（用户：全部不需要折叠状态，常驻展开）。删掉 `treeOpen` state；`clickRootRow` 只做 `setFilter('all')` + 清分组筛选；根行 `TaskMarker` 的 `open` 固定 true，去掉 `{treeOpen && (...)}` 包裹，四个子分类恒常渲染。CDP：连点「全部」两次侧栏始终 5 行，根环选中时箭头 `matrix(0,1,-1,0,0,0)`。同轮用户验收通过任务栏第二批与分组新建（`任务栏改版` / `分组新建` 转完成）。
- 2026-10-31：**拖拽越过不同状态行修复**。用户报「全部列表下其他任务可自由排序，但无法越过那个父任务」。根因：该父任务原始 `status=in_progress`，但子任务仍待办、派生状态为 pending，所以渲染在「待办」区；`overRow` 用**原始 status** 做同节判定，跨节直接 return，于是永远拖不到它上面。修复：顶层任务（`!task.parentId`）不做状态判定，`ids` 改为基于 `activeRoots` 全量重排；只有子任务保留同节限制（子任务按 status 分节渲染）。CDP：拖 `a03b6a` 到 `f30445` 上方 → 预览 `a03b6a,f30445,77d08a,a0b335` → 落库 order `0,1,2,3`。同轮登记新需求「跨状态拖拽」（拖到别的状态节时顺带改状态），尚未实现。
- 2026-10-31：**子任务跨状态节拖拽**（用户：就是子任务需要修改）。`overRow` 去掉子任务的同节限制：同节落到 before/after 重排，跨节落到目标行则 `preview.status = dragged.status`、`toStatus = 目标节`；`itemsFor` 跨节时源节剔除拖动行、目标节按 `preview.ids` 插入；`.dstl-section-box` 加 `onDragOver/onDrop` → **空节也能拖进去**（落点 = 该节末尾）；`commitPreview` 跨节时一并写 `status`（落到完成补 `completedAt`）。CDP：拖 `d848e5`（待确认）到父任务「进行中」空节 → 预览 `box3 → box2`，drop 后 `status=in_progress`。
- 2026-10-31：**M2 批 2 动画第一轮**（按参考实现 client.js）。①环两段过渡：`TaskMarker` 原有（exit 1s → enter 1s）保留不动；②换节：跨节时行节点会被 React 重建，FLIP 拿不到稳定的旧 rect（内联 transform+rAF 与 WAAPI + 操作前快照两种写法都不稳定），改为 TaskPanel 级 `prevStatusMap` 比对状态变化 → 行加 `.dstl-row-jump` 播 0.24s 落位动画（`@keyframes dstl-row-jump`）；③折叠：移植 client.js 2001–2031 的 `collapseBoxes` —— 折叠前 `snapshotRects`，对 `[data-section-owner]` 的 `.dstl-section-box` 手写 height/padding/margin/border/opacity/transform 归零，260ms 后再 `setCollapsed` 卸载；展开直接挂载（新节点无内联残留）。FLIP effect 依赖补 `collapsed`。**未实测**：当前数据里没有展开中的父任务（`.dstl-row-head` 只剩两个 dock 头），折叠与换节动画都还没跑到有效样本，待实机验收。
- 2026-10-31：**动画第二轮（用户四条反馈）**。①换色：`TaskPanel` 记 `prevStatusOf`（变化前的状态），经 `rowProps` 传给 `TaskRow` → `TaskMarker prevStatus`，让新挂载的环先播旧色 exit 再新色 enter；②折叠：`data-section-owner` 从 `.dstl-section-box` 上移到新的 `.dstl-status-block`（节标题+框一起收缩），CSS 补 `.dstl-status-block` 的 height/padding/margin/border/opacity/transform 过渡；③展开：完成/废弃 body 加 `dstl-entering`（`@keyframes dstl-block-in` 左侧滑入，420ms 后移除）；④dock 互斥：`toggleCompleted` / `toggleAbandoned` 按参考实现 2495–2553 处理——展开一个先收起另一个，废弃区折叠走 body 的 height 归零 + 260ms 后卸载。CDP：折叠时 4 个 `[data-section-owner]` 高度全变 `0px`（标题块已纳入）；**完成展开时废弃 body 为 false（互斥生效）**。**待查**：260ms 后节块未卸载（计数仍 4），折叠的"收完再移除"这一步还没验证通过。
- 2026-10-31：**dock 按插件行为重做**（用户：常驻只该有废弃，鼠标放上才出完成，完成区要能滚动）。①外层包 `.dstl-docks`，`onMouseEnter/Leave` 维护 `dockHover`；完成 dock 的 `dstl-complete-revealed` 改为 `dockHover || completedOpen` 时才加 → 常驻 `max-height 0`、悬停滑出；②`.dstl-complete-dock.dstl-complete-revealed` 加 `overflow-y:auto` + 32vh 上限，内容多可滚；③换色改为操作时同步 `markStatusChange`（cycle / 拖拽跨节），1 项已验收通过。CDP：常驻完成 dock `max-height 0px`、废弃 dock 高 53px；鼠标移入后完成 dock `max-height 217.92px`。**仍不通过**：展开动画（2/3）、折叠标题（2 回归）待继续。
- 2026-10-31：**展开动画补齐**（用户：所有父任务展开都没有动画）。`toggleCollapse` 的展开分支加 `snapshotRects()` + `expandingId`（420ms 清除），`renderGroup` 给该父的 `.dstl-status-block` 加 `dstl-entering` → 四个节块从下方 8px 淡入。CDP：先折叠（12 块）再展开，`[4,4,4,4]` 连续采样均带 `dstl-entering`，420ms 后归 0、块数回到 16。
- 2026-10-31：**M2 批 2 收尾：横滑 / dock 对齐 / 两处动画缺陷**。①展开按用户反馈改为**从左向右横滑**，照参考实现 `.dstl-item-in`：`translateX(-16px) → 0`、`.34s cubic-bezier(.2,.8,.2,1) both`（原来是自己写的 `translateY(8px)` 纵向淡入）；②补 `restoreBoxes(id)`（展开前清内联折叠残留，参考实现同名函数）；③完成 dock 按参考实现拆两档：`.dstl-complete-revealed` 浮出 `max-height 220px`，`.dstl-complete-open`（点击 pin 后才有）`max-height 50vh` + `overflow-y:auto` 可滚 —— 原来把滚动写在 revealed 上、且没有 open 类；④废弃 dock 隐藏条件改 `completedOpen && !dockHover`（参考实现口径），修掉「完成区一展开废弃整块消失、头都点不到」；⑤**折叠到位弹跳**（用户报）：折叠分支原先 `snapshotRects()`，260ms 后卸载时 FLIP 又按折叠前快照重放整段位移 → 行被高度过渡推到位后再跳一格。改为折叠不拍照、只由 block 高度过渡推动行。CDP 采样：下方行 top `289 → 109` 单调、0 个 WAAPI 动画帧；⑥**展开闪烁**（用户报）：原先「块瞬间占满高度 → 行瞬移 → FLIP 拉回 → 内容 opacity 0 淡入」四件事叠加。改为**与折叠对称**：块挂载后由 `useLayoutEffect` 把它按到 `height 0` / `opacity 0` / `translateX(-16px)`，再过渡到自然高度（复用同一套 `.24s` transition），**不再 FLIP**；节块上的 `expandingId` / `dstl-entering` 停用（dock body 仍用该 keyframes）。展开清理用 `dataset.expanding` 标记，260ms 内又折叠的不动它的过渡。构建 `index-CwLxmC5J.js`。**状态**：展开横滑、折叠已由用户验收通过；折叠弹跳 / 展开闪烁 / dock 三档改动待复看。
- 2026-10-31：**M2 批 2 全部验收通过**（用户「很好，验收通过」）。新需求**新建入场动画统一**（用户：新建任务、新建分组的动画要和任务列表中的新建任务动画同步）。照参考实现 1671–1683 的 `entering` 机制补齐：①`TaskPanel` 新增 `enteringIds` / `seenIdsRef`，首屏只记录已见 id（打开不整列表飞入），之后新出现的 id → `markEntering`（420ms 后清空）；②`TaskRow` 新增 `entering` 参数 → 外层 `.dstl-item` 加 `dstl-item-in`（样式本来就有：`translateX(-16px)→0` + 淡入 `.34s`）+ `TaskMarker enterOnMount`（环填充）；③`startCreate` 在 `persist` 之前同步 `markEntering([id])`，新建行**首帧**就带类，不靠 effect 补一帧；④侧栏第三层同款：`groupSig` 比对组全集（`category:name`）→ 新组 → `markEnteringGroup`，组行加 `dstl-item-in`、组环 `enterOnMount`；`commitNewGroup` 同步标记；⑤「新建分组」的输入框（`.dstl-side-group-new`）挂载即带 `dstl-item-in`，点 `+` 的即时反馈与新建任务一致。构建 `index-DcF2CL4T.js`。

- 2026-10-31：**「完成父任务里拖子任务改状态」＝真 bug，已修**（此前本文件误记为「非 bug」，已作废，见本条末尾）。用户现象：「子任务到了正确的分区但没有转换状态」（截图：完成 dock 内父任务 A，子 B 预览在「待办」节、状态仍是 completed）。**根因**：参考实现里 `.dstl-section-box` **同时包住节名与卡片**，整块都是投放区；我们的结构把节名拆到 `.dstl-section-box` 之外了（改 `data-section-owner` 时只上移了 owner，投放区仍只有卡片框）——空节框只剩 ~8px 高，用户实际把鼠标落在「进行中／待办」这类**节名文字**上时，那里没有 `onDragOver/onDrop`，`preview` 只驱动渲染、松手不提交 → 行停在目标分区但状态没转。**修复**：把 `onDragOver` / `onDrop` 从 `.dstl-section-box` 上移到 `.dstl-status-block`（节名 + 虚线框整块可投，与参考实现的框结构等价），`overSection` 里 `event.target.closest('.dstl-row')` 的排除保留（落在行上仍交给 `overRow` 做 before/after 精细落点）。隔离实例验证：拖 `bbbb` 落在「进行中」**节名**上 → 预览 `[0,1,0,1]`、drop 后 `bbbb=in_progress`。构建 `index-D-LCppOU.js`。
  - **教训（白皮书第⑤条）**：上一轮我用合成事件把 drop 精确 dispatch 到 `.dstl-section-box`，恰好绕开了真实落点，得出「状态正确改变 → 不是 bug」的结论并写进本文件——这是拿测试反驳用户观察，界面事实优先。今后判定「不是 bug」前，必须按用户的操作路径（落点、位置）复现，而不是自己构造的一条顺路。
  - **教训（CDP 拖拽）**：模拟 HTML5 拖拽要把 `dragstart` / `dragover` / `drop` 分成三次 evaluate 各等 ~400ms；同一次 evaluate 连发会因 React 尚未提交 `dragId` 而误判「拖拽无效」。`Input.setInterceptDrags` 在本机窗口内没能拦到 dragstart，真实拖拽还是靠合成事件 + 与用户一致的落点。

- 2026-10-31：**M2 批 2 阶段收尾确认**。用户验收通过「节名落点拖拽」修复。至此 M1 / M2 批 1 / M2 批 2（环换色、展开横滑、折叠、dock 常驻与滚动、折叠弹跳、展开闪烁）/ 侧栏分类树与分组 / 任务行改版 / 拖拽（排序、换分类、换组、跨状态、节名落点）/ 新建任务与新建分组入场动画 全部通过。构建 `index-D-LCppOU.js`，`task-store` 57 单测通过。**下一步 M3 备份与转移**（§7 第 18–22 项）。

- 2026-10-31：**M3-1 设置里的本机目录 / 备份目录**（用户：设置里要能决定这两个目录）。①`main.cjs` 的 `configFile()` 从 `appData/mr-baoyuan-todo` 改为 `app.getPath('userData')`——正常运行路径等价，但 `--user-data-dir` 的隔离实例不再污染真实配置；②`todo:setDir('data', …)` 支持传 `null` 恢复默认，**切目录时自动把当前 `tasks.json` 复制到新目录**（目标已有则不覆盖，返回 `conflict: true`），返回 `{ dataDir, backupDir, dataDefault, backupDefault, migrated, conflict, restart }`；③新增 `todo:relaunch`，前端在切本机目录后 1.2s 自动重启，避免「重启后落在空目录 = 看起来丢任务」；④设置弹层两行改为「本机目录（数据文件）」「备份目录」，默认态显示「默认位置 / 默认：本机目录下 backups」，非默认态多一个「默认」按钮一键恢复；⑤备份目录改动仍即时生效，默认值跟随本机目录。隔离实例验证：切到 `F:\DSH\temp\sd-data-test` → `migrated:true, restart:true`，目标目录出现 `tasks.json` 且含原任务；改备份目录立即生效；两项恢复默认均回到默认路径；设置 UI 两行文案与按钮正确。构建 `index-BVuPbCO4.js`。**注意**：`main.cjs` 改动需**重启应用**才生效（reload 窗口不够）。

- 2026-10-31：**M3-2 盘识别（卷序列号）+ 设置文案精简**。①设置弹层不再显示具体路径（用户：不需要显示具体目录，保留文字就行）：两行只留「本机目录」「备份目录」+ 更改 /（非默认时）默认 按钮；备份盘离线时行尾出红色「未连接」小标。②备份目录改存 `backupVolume: { serial, rel }`——`serial` 取自 `fs.statSync('X:\\').dev`（Windows 上就是卷序列号，实测 C=`885477772`、F=`718269017`），`rel` 为相对盘符根的路径；`resolveBackupVolume()` 每次读配置时按 serial 扫 C–Z 找当前盘符，移动硬盘从 `F:` 变 `G:` 也能定位。③盘离线时 `backupNow()` 直接抛「备份盘未连接，请接入后重试」，不往空路径写。④`getConfig` / `setDir` 均返回 `backupOnline`。隔离实例验证：设备份目录 → config 写入 `{"serial":718269017,"rel":"DSH\\temp\\sd-backup-test"}`；把 serial 改成假值后重启 → `backupOnline:false`、设置行显示「未连接」、备份报错；恢复默认后 `backupOnline:true`、备份正常。构建 `index-BSzpmXQy.js`。**注意**：`main.cjs` 改动需重启应用才生效。

- 2026-10-31：**固定 TODO 子文件夹**（用户：无论建在什么目录都自动追加 TODO）。规则：所有用户选的目录（本机 / 备份）在读取时统一追加一层 `TODO`——`dataDir()` = `withTodoFolder(config.dataDir || userData)`，`resolveBackupVolume()` 返回的目录同样过 `withTodoFolder`；`withTodoFolder` 幂等（目录本身叫 TODO 不再嵌套）。`setDir('data')` 存的仍是**原始选择**（`config.dataDir`），`setDir('backup')` 存解析后的 `…/TODO`。默认位置因此变成 `%APPDATA%\mr-baoyuan-todo\TODO`，默认备份 `…\TODO\backups`。新增 `migrateIntoFolder()`：启动时若 `<原目录>\tasks.json` 存在且 `<原目录>\TODO\tasks.json` 不存在，复制一份进去（原文件保留）。
  - **踩坑（已修，数据未丢）**：首次上线时 `whenReady` 里 `migrateLegacyData()` 排在 `migrateIntoFolder()` 前面——旧版 `shuangduan-todo` 的两条历史数据先被写进 `…\TODO\tasks.json`，随后 `migrateIntoFolder()` 见目标已存在就跳过，真实的 18 条留在 `…\tasks.json` 没被搬过去，界面看起来「只剩 2 条」。修法：**先 `migrateIntoFolder()` 再 `migrateLegacyData()`**（legacy 只在目标为空时垫底），并删掉被抢占的那份 TODO 文件重跑迁移。复验：`…\tasks.json` 与 `…\TODO\tasks.json` 均 18 条一致；备份目录 `E:\` 解析为 `E:\TODO`，`backupOnline:true`。
  - 隔离实例验证：默认 `dataDir` 以 `\TODO` 结尾、根上的旧 `tasks.json` 被复制进 TODO；选 `…\sd-choose` → 数据落 `…\sd-choose\TODO`；再选 `…\sd-choose\TODO` 不出现双层 TODO（`restart:false`）；备份目录选 `…\sd-backup` → 备份写进 `…\sd-backup\TODO\`。

- 2026-10-31：**M3-3 自动备份**。`config.autoBackup = { start, exit, every }`（默认 `{start:true, exit:false, every:0}`；`every` 单位分钟，0=关）。①启动：`whenReady` 后 2.5s 调 `autoBackupQuiet()`；②退出：`app.on('before-quit')` 同理（`app.exit(0)` 的重启路径不触发，可接受）；③定时：`armAutoTimer()` 按 `every` 挂 `setInterval`，`todo:setAutoBackup` 保存后重建定时器。静默变体 `autoBackupQuiet()` 吞掉异常——离线/不可写时不弹窗、不崩退出。设置面板第三行「自动备份」+ 三个开关（启动 / 退出 / 定时=30 分钟），选中态用品牌色实心（`.dstl-settings-toggle.on`）。隔离实例验证：`getConfig` 返回默认 `{start:true,...}`；启动 2.5s 后默认备份目录出现 `tasks-<ts>.json`；`setAutoBackup({start,exit,every:30})` 落盘并在 UI 读到三个开关状态；点「定时」切回 0 生效。构建 `index-ChUarfeI.js`。
  - **实测发现**：用户当前备份目录是 `E:\`（解析为 `E:\TODO`），而 **DSH 会话里启动的 electron 写 E 盘报 EPERM**（PowerShell 同路径可写）——疑似 DSH 沙箱对子进程的写入限制，手动双击 `start.bat` 启动应不受影响；真实使用前请点一次「备份数据」确认。另外 Windows 盘根 `E:\` 建目录可能受 ACL 限制，**建议把备份目录选到具体文件夹（如 `E:\备份`）而不是盘根**。

- 2026-10-31：**M3-4 导出 export.json**。①`main.cjs` 新增 `todo:export`：无参数走 `dialog.showSaveDialog`（默认落 `backupsDir()/tasks.export.json`），传了路径就直接写（自动化测试用，UI 不传）；文件结构 `{ version:1, deviceId, exportedAt, tasks }`，每个任务自带 `version`（任务级修订号，即 M3 差异比对的 rev）与 `updatedAt`。②`preload` 暴露 `exportTasks(target?)`。③设置弹层加「导出数据（.export.json）」按钮，成功后在 footer 显示「已导出 N 条任务」+ 文件路径。隔离实例验证：导出 `count:2`、键 `[version, deviceId, exportedAt, tasks]`、单任务含 `version:3 / updatedAt`。构建 `index-C68XLvcb.js`。

- 2026-10-31：**应用启动方式踩坑**（用户「打不开」）。`cmd /c start "" electron.exe …` 在本会话启动后进程在、CDP 可连，但**没有可见窗口**（`MainWindowHandle` 为 0），用户看不到。可靠做法：用后台 job 前台跑 `node_modules\electron\dist\electron.exe . --no-sandbox --disable-gpu > log 2>&1`（不带 `--remote-debugging-port` 也行），5s 后 `Get-Process electron | ? MainWindowTitle -like '*待办*'` 拿到句柄，再 `ShowWindow(hwnd, 9)` + `SetForegroundWindow(hwnd)` 置前。以后给用户开工就用这条链路。

- 2026-10-31：**修「打不开」= 补单实例锁**。根因：`main.cjs` 没有 `requestSingleInstanceLock`，应用已开着时再双击 `start.bat` 会起第二个进程、共用同一个 `%APPDATA%\mr-baoyuan-todo` userData，Chromium 的 profile 锁让第二个进程在创建窗口前就退出，用户看到的就是「双击没反应 / 打不开」。修复：文件顶层加 `app.requestSingleInstanceLock()`，没抢到就 `app.quit()`，抢到的注册 `second-instance` → `win.restore()/show()/focus()`，整个 `whenReady`/`before-quit`/`window-all-closed` 包进 `else` 分支。验证：首个实例窗口 1 个；再执行 `start.bat` 后待办窗口仍是 1 个（第二实例安静退出），进程数不变。
  - 另记环境现象：**在本会话里用 `cmd /c start.bat` 或 `cmd /c start "" electron.exe …` 启动的实例拿不到可见窗口**（进程都不留痕），必须用后台 job 前台跑 `electron.exe . --no-sandbox --disable-gpu` + `ShowWindow(hwnd,9)`/`SetForegroundWindow(hwnd)` 才有窗口。用户从 Explorer 双击不受此限。

- 2026-10-31：**「打不开」的真正根因 = start.bat 的尾反斜杠**（不是单实例锁，锁是另一个隐患，保留）。`start "" "…electron.exe" "%~dp0"` 里 `%~dp0` 以反斜杠结尾，引号内的 `\"` 被 Windows 当作转义引号，electron 收到的 app 路径不对 → 进程启动即 `exit 1`、没有任何窗口、日志也是空的。实测对照：同一 bat，`"%~dp0"` 失败（exit 1、无窗口），改成 `"%~dp0."` 成功（窗口出现、日志空）。`start.bat` 已改为：
  ```bat
  set ELECTRON_RUN_AS_NODE=
  cd /d "%~dp0"
  start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." --no-sandbox --disable-gpu
  ```
  以后改启动脚本别再写成 `"%~dp0"` 结尾。

- 2026-10-31：**备份目录改回默认（C 盘）**。用户自己双击 `start.bat` 后点「备份数据」仍报 `EPERM copyfile → E:\TODO`（4 次），说明 E 盘在当前环境确实写不进去而非启动方式问题；按用户「修改目录」把 `config.json` 的 `backupDir` / `backupVolume` 置空，备份回到 `<dataDir>/backups` = `%APPDATA%\mr-baoyuan-todo\TODO\backups`。验证：`getConfig` 显示 `backupDir` 为默认路径、`window.todo.backup()` 返回 ok 并生成文件；重启后 2.5s 的启动自动备份也成功写出两份。E 盘为什么拒绝写入仍未查明（ACL 显示 Authenticated Users 有写权限、PowerShell 可写，只有 electron 进程被拒），暂不追。
- 2026-10-31：**start.bat 修复后用户可自行启动**（进程命令行证据：`electron.exe "F:\…\抱怨先生的待办列表\." --no-sandbox` 即新 bat 的 `%~dp0.` 形式），单实例锁同时生效（我另起的实例拿不到锁安静退出）。

- 2026-10-31：**M3-5 启动盘检查 + M3-6 差异裁决**。①`main.cjs` 新增 `latestBackupFile()` / `readBackupSnapshot()` / `buildDiff()`：读备份目录下最新的 `tasks-*.json`，按任务 id 整条比对，分 `local-only`（本地新增）/ `backup-only`（备份新增）/ `changed`（双边改动，带 localVersion / backupVersion）；备份盘离线时返回 `online:false`。②`todo:checkDiff` / `todo:applyDiff(choices)`：choices 形如 `{ taskId: 'local' | 'backup' }`，选 backup 取快照整条（快照里没有就是删除），选 local 保留本地，`saveStore` 落地。③前端启动检查：`checkDiff + info` 并行，离线只弹一句「备份盘未连接，已使用本地数据」并继续（§7.0）；**只有快照 `deviceId` 与本机不同**才弹差异面板——本机自己的旧快照差异属于正常「还没备份」，不该每次启动都打扰。④差异面板：遮罩 + 列表（类型标签 / 标题 / v 版本号 / 本地·备份两个按钮）+ 底部「全部用本地 / 全部用备份 / 应用并关闭」，整条二选一不做字段级合并。隔离实例验证：本机快照不弹面板；把快照 deviceId 改成本机以外 + 改一条标题后 reload → 面板打开 3 条（`双边改动 B旧 / 本地新增 C新 / 双边改动 A旧`）；点「全部用备份 + 应用并关闭」→ 任务变成快照的两条、面板关闭。构建 `index-DhG1InIT.js`。

- 2026-10-31：**设置里加「读取备份并比对」**（用户要手动测差异面板）。`readBackupDiff()` 调 `todo:checkDiff()`：离线 → 底部「备份盘未连接」；快照为空 → 「备份目录里还没有快照」；无差异 → 「与备份一致」；有差异 → 直接打开差异面板。**手动触发不看快照 `deviceId`**（启动时的自动检查才做本机过滤），所以本机自己的旧快照也能拉出来测。构建 `index-COxKOaAf.js`。

- 2026-10-31：**整体配色 / 边线 / 投影对齐 DSH（用户选方案 A）**。把 `styles.css` 的 `:root` 从旧的暖米 palette 换成 harness 实际值：背景 `#f9fafb`（`--dsw-alias-app-bg`）、卡片 `#fff`、`--dsw-alias-bg-layer-2` `#f9fafb`、边框 `rgba(0,0,0,.04)` / `rgba(0,0,0,.10)`、文字 `#0f1115` / `#61666b` / `#81858c`、hover `#f2f4f7`；新增 `--dsw-shadow-soft`（`0 8px 24px rgba(15,17,21,.06)`）与 `--dsw-shadow-pop`（`0 16px 40px rgba(15,17,21,.14)`），替换三处硬编码阴影和遮罩色。品牌蓝 `#3749a4` 与状态色（绿/黄/红）不动。色值来源：`app.asar` 里 `--dsw-static-neutral-bluish-00/50/600/700/1000` 与 `--dsw-alias-border-l1/l2`。构建 `index-Dm7uQSOO.js` / `index-BzIUBdtC.css`。
  - **事故记录**：为装 `electron-builder` 跑 `pnpm install` 时，pnpm 报 virtual store 指向旧项目 `双端待办\app\node_modules\.pnpm`，需要 `CI=true` 重建；重建后 **electron 的 `dist` 二进制没被下载**（pnpm 默认跳过依赖的 postinstall），导致 `electron.exe` 路径不存在、应用启动报 "The system cannot find the path specified"。修法：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js` 手动补下二进制。以后重装依赖后先确认 `node_modules\electron\dist\electron.exe` 存在。

- 2026-10-31：**交接（用户要求结束本会话）**。本轮最后一段：给侧栏分类/分组加滑入滑出动画（先后两版实现），用户不满意并要求回滚 —— 已回滚干净：`clickCategoryRow` 恢复为纯 `expandedCats` 切换，移除 `groupClosing`/`groupTimers`/`dtl-item-out`/`data-group-owner`/`.dstl-side-groups` 的 transition 与 `dstl-item-in`，以及「全部」的整树重挂载。当前 `M1 / M2 / M3` 全部验收通过，侧栏分组无自定义展开动画（与 M2 收尾时一致）。配色方案 A 保留（用户此前明确选择）。构建 `index-ChsDetBS.js`。
  - **下一会话起点**：M4 打包。已具备：`build/icon.ico`（256/128/64/48/32/24/16）、`node_modules` 已重建（electron 45.1.0 / vite 8.3.5 / react 19.3.1）。**未做**：electron-builder 安装与 `package.json` 的 `build` 段（NSIS + portable、appId、files、icon）、托盘常驻、开机自启、安装版冒烟。重装依赖后务必先确认 `node_modules\electron\dist\electron.exe` 存在（pnpm 默认跳过 postinstall，丢过一次二进制，用 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js` 补）。

- 2026-10-31：**侧栏标题复用父任务标题滑动**（用户验收通过）。`.dstl-side-label` 常态 `margin-left:-11px` + `transition:margin-left .2s ease`；`.dstl-side-row:hover` / `.dstl-side-row.dstl-side-on` 下 `margin-left:6px`——与 `.dstl-row-head .dstl-title` 同值同曲线，悬停与选中态标题右滑 17px 让出放大旋转的环箭头，与环的距离恒定。只动「全部」+四分类，分组行未改。构建 `index-B9D1p9BY.css`。
- 2026-10-31：**M4-1 出包 + 托盘 + 开机自启（待用户实测）**。①electron-builder 26.18.0 未走 pnpm add（会重装 node_modules、上次把依赖搞坏过）——`.pnpm` 里已有包，直接给 `vite / electron / @vitejs/plugin-react / electron-builder` 建顶层 junction 恢复，再 `vite build`。②`package.json` 加 `build` 段：appId `com.mrbaoyuan.todo`、files（dist/electron/icon.png/package.json，排除 node_modules）、win target `nsis`+`portable`（x64）、`electronDist: node_modules/electron/dist`（跳过下载）、nsis 可改目录/桌面与开始菜单快捷方式。③`main.cjs`：`Tray`（build/icon.png 缩到 16px）、关闭→隐藏并首次 `displayBalloon` 提示、托盘左键显隐、右键菜单（显示/隐藏、退出，退出置 `quitRequested`）、`--hidden` 启动静默进托盘；`todo:getAutoStart`/`todo:setAutoStart`（`app.setLoginItemSettings` + `--hidden`，开发版返回 `packaged:false`）。④`preload` 暴露两方法；设置面板加「开机自启」开关，开发版点击提示「安装版生效」。⑤产物：`release\抱怨先生的待办列表 Setup 0.1.0.exe`（120MB）、`release\抱怨先生的待办列表 0.1.0.exe`（portable 109MB）、`release\win-unpacked\`；asar 已含 dist/electron/icon.png。⑥冒烟：win-unpacked 以隔离 `--user-data-dir` 启动成功、窗口标题正确、生成 `TODO\tasks.json`；冒烟实例已杀、隔离目录已删。**待用户实测**：关闭→托盘、托盘左键显隐/右键退出、安装版开机自启开关。
  - **坑**：electron-builder 下载 electron 包时 `unable to verify the first certificate` → 用 `electronDist` 指向本地 `node_modules/electron/dist` 绕过下载；NSIS 等二进制下载仍走 `ELECTRON_BUILDER_BINARIES_MIRROR` + `NODE_TLS_REJECT_UNAUTHORIZED=0`。**DSH 环境 `ELECTRON_RUN_AS_NODE=1` 会让打包 exe 秒退（exit 0、无窗口）**，冒烟前必须清除该变量（`start.bat` 已清）。pnpm add 中断会删坏 node_modules（vite/electron 顶层链接消失）——恢复办法：从 `.pnpm\<pkg>@<ver>\node_modules\<pkg>` 建 junction，不重装。




## 10. 插件化接入（2026-11-05）

> 用户决定：**不再作为独立软件**，改为 DSH 插件、独立界面、整合进右侧边栏。Electron 版（M4 已出包）保留不动，作为同一份 `tasks.json` 的另一读法。

### 10.1 四个已拍板分叉

| 分叉 | 结论 |
|---|---|
| 与左侧「任务列表」的关系 | **并存、数据独立**：左侧仍是 `task_list`/`task_write` 的会话任务；右侧是个人待办 |
| 数据落点 | **沿用** `%APPDATA%\mr-baoyuan-todo\TODO\tasks.json`（读 `config.json` 的 dataDir + 自动追加 TODO 子目录），与桌面版共用同一份文件 |
| 首版形态 | **保留完整两栏**（分类树 + 列表），右侧栏可拖宽 |
| agent 工具 | **给一套独立工具**：`todo_list` / `todo_add` / `todo_update`（与 task_list 明确区分） |

### 10.2 文件地图（新增 `plugin/`，不碰 Electron 工程）

```
plugin\
  package.json            @local/dsh-todo-list；dsh.bundle.patch + dsh.client（inject 三个 client 包名）
  cordis.patch.yml        insert 一行 todo-list
  index.js                Host 半：目录解析 / 原子写 / 备份 / 导出 / 差异裁决 / 9 条 HTTP / 3 个工具 / 定时备份
  client.js               **构建产物**（rolldown 打包 + ModuleLoader 包装，勿手改）
  build.mjs               打包脚本：styles.css→styles-text.js，rolldown → client.js
  lib\task-store.js       从 src\core 拷贝的纯逻辑（Host 工具用）
  src\client\index.jsx    注册 tab 类型 / body / title / 会话头部入口 + 样式注入
  src\client\todo-api.js  window.todo.* 的 HTTP 替身（9 个方法）
  src\ui\*                TaskPanel / TaskRow / TaskMarker / TaskProgressRing / styles.css（改自 Electron 版）
  locale\zh.json,en.json  meta.title / meta.description
  icon.svg                原创图标（藏蓝底 + 白勾 + 淡环）
```

### 10.3 右侧栏 tab 的契约（已从 asar 源码查实）

- **两段式注册**：`ctx.sidebarRightTabs.register({ id, kind, title, priority, guide })` + keyed slot `sidebar.right.pane.tab` / `.title`（`key` = definition 的 `id`）+ `ctx.sidebarRight.openTab(kind, { params })`。
- `title` 是**函数**，打开那一刻求值写进布局；`params` **不落盘**（只在本次打开有效），本插件不传参所以不受影响。
- tab **严格 session-scoped**（`scope:'session'`，无屏上会话时 `openTab` 抛错）；内容可以是全局数据。
- 入口选了 `conversation.session.header.utilities`（id `todo-list-entry`, order 6）+ definition 的 `guide` 卡片。
- `package.json` 的 `dsh.client.inject` 写**包名**；`client.js` 的 `inject` 数组写**服务名**（`sidebarRightTabs` / `sidebarRight`）。

### 10.4 改 UI 时的硬约束（样式污染）

- Electron 版 `styles.css` 的 `:root` 变量块、`html/body/#root`、`*` 选择器**全部收敛**到 `.dstl-app` / `.dstl-app *`：注入的样式表绝不许重绘宿主。
- `.dstl-diff-mask` 的 `position:fixed` 改 `absolute`（否则遮罩盖住整个 DSH 页面）。
- 变量不再自建 `:root` 默认值 → 跟随 DSH 主题，缺失时用各规则里的十六进制 fallback。
- 新增插件外壳样式在 `styles.css` 末尾：`.dstl-todo-tab`（撑满 tab）、`.dstl-todo-header-btn`、`.dstl-todo-tab-title`。

### 10.5 数据层改动清单（TaskPanel.jsx）

- `window.todo.*` → `todoApi.*`（22 处）；`todo-api.js` 走同源 `/todo-list/api/*`。
- 删掉桌面专属：开发者工具、重新加载界面、开机自启、本机/备份目录「更改/默认」按钮、`relaunch`；设置里目录改为只读展示。
- 自动备份只保留「每 30 分钟」开关（`start`/`exit` 是壳的语义，插件里没有）。
- 保留：新建/重命名/五态/分类/分组/拖拽/截止日/备份数据/导出/读取备份并比对/差异裁决。

### 10.6 已完成的验证

- `todo_list` 工具读到现有数据：13 条未完成（全部 18 条，含分类/分组/父子/截止）。
- HTTP `GET /todo-list/api/state` → 200，`dataDir` = `C:\Users\Administrator\AppData\Roaming\mr-baoyuan-todo\TODO`。
- Client 注册已确认：`sidebar.right.pane.tab` 出现 `@local/dsh-todo-list/todo`；`conversation.session.header.utilities` 出现 `todo-list-entry`。
- 打包链：`node plugin/build.mjs`（rolldown 1.2.16，来自 vite 8 的 pnpm store）；`client.js` 141KB，`node --check` 通过。

### 10.7 待验证 / 下一步

- **需重启 DSH** 才会加载新的 Client JS 生成（替换已安装包同理）。
- 界面上：右侧栏是否有「待办列表」tab、会话头部勾选按钮能否打开、面板在 300–400px 宽下两栏是否可用、拖宽后是否正常。
- 交互：新建 / 改状态 / 切分类 / 拖拽 / 备份 / 导出是否都落到同一份 `tasks.json`（可用 `todo_list` 交叉核对）。
- 暂缺：整页 `main` 面板形态、快捷键、差异面板的启动自动检查（当前只在设置里手动「读取备份并比对」）。

### 10.8 踩坑

- **esbuild 不可用**：vite 8 = rolldown，项目 `node_modules` 没有 esbuild。打包改用项目 `.pnpm\rolldown@1.2.16` 的 JS API，路径要显式 `pathToFileURL` 导入（plugin 目录解析不到）。
- **ModuleLoader 包装**：esbuild/rolldown 输出 CJS 时，外层要先声明 `var module={exports:{}}; var exports=module.exports;`，再 `return module.exports`；react / react-dom / react/jsx-runtime 必须 external，由页面模块表提供。
- **CSS 当文本模块**：建 bundle 前把 `styles.css` 生成 `styles-text.js`（`export default "<css>"`），构建产物里没有 CSS loader。
- **`.png` 图标不适用**：插件 icon 用 SVG，路径必须在包内，`files` 要带上。
- **改 Host 半也要重启**：`install_bundle` 对已安装包只做 link，不会重载模块；`{code:"already-installed"}` 是正常现象。
### 10.9 验收后修复批（2026-11-05）

用户验收通过后报三条 bug，均已改完重打包（`client.js` 144011 B，无 type error），**需重启 DSH 生效**：

| 现象 | 根因 | 修法 |
|---|---|---|
| 独立任务四态转不了 | `TaskRow` 环的 `onClick` 写成 `task.parentId ? onCycle : undefined`，没有 parentId 的顶层任务拿不到 handler | 改为 `hasChildren ? onToggleCollapse() : onCycle(task, false)` |
| 删除/废弃没反应 | `visible` 只在 `children.length === 0` 时排除 abandoned，废弃**父任务**后它仍留在活列表 | 所有 `abandoned` 根一律移出活列表；abandon/restore 写 foot notice |
| 待办 vs 文件要分页切 | 右侧栏 tab 并存 | `openExclusive()` 打开前关掉同会话其它 tab；另订阅 `ctx.sidebarRight.openTabs` 反向收起自己 |

**互斥的第二半是尽力而为**：`openTabs` 是 sidebar-right 包私有的 observable，快照形状没在文档里，代码兼容「数组 / 按会话的对象」两种并带递归保护，形状不符时静默不动作（不会报错）。若实测反向不生效，只剩「点按钮即切过去」这一半，仍需进一步查快照结构。

**取舍**：彻底删除仍保留在 `Shift + 点击垃圾桶`（有 `window.confirm`），普通点击 = 废弃。`window.event` 判断改为从事件对象直接读 `event.shiftKey`。
### 10.10 第二轮修复（2026-11-05）

**已修并重打包**（`client.js` 146656 B，无 type error），重启生效：

1. **废弃二次确认**：参考 `dsh-workspace-frontend` 的 `confirmDelete`（`client.js` 1367-1371 用 `setTimeout(…, 4000)` 复位、1524-1534 待删除时按钮加 `dssx-danger`）。我们的垃圾桶是 26px 行内按钮，放不下「确认删除」四个字，所以保留「变红」信号，把文字换成**倒计时环 + 勾**：第一击红底、环从满到空走 4 秒，期内第二击才废弃；超时自动复位；`Shift + 点击`仍直接彻底删除。实现位置 `TaskRow.jsx`（`confirmArmed` + `confirmTimer`，卸载清理）与 `styles.css`（`.dstl-confirming`、`@keyframes dstl-confirm-countdown`，`stroke-dashoffset` 0→39）。
2. **四态循环上跳**：根因是 `markStatusChange` 无条件 `setJumping`，于是普通状态循环也给行加了 `.dstl-row-jump`——那条动画是 `translateY(10px) → 0` 的**落位**动画，本来是给「子任务跨节换位」用的；顶层平铺行根本没换位置，却被逼着播，于是先沉 10px 再弹回。修法：把 `jumping` 从 `markStatusChange` 拆出去成 `markRowJump`，只有 `commitPreview()` 里真正跨节拖拽时才调用。

**暂停待讨论**：右侧栏互斥（`todo-mutex`）。`openExclusive` 先 `close` 其它 tab 再 `openTab`，`watchExclusive` 订阅 `openTabs` 反向收起，两者实测均无效。待查方向：
- `ctx.sidebarRight.close(tabId)` 与紧随的 `openTab` 在同一 tick，post 出去的布局提交可能互相覆盖；
- `tabsIn(sessionId)` 只对**已 adopt** 的会话有数据，打开前可能拿到空数组；
- `openTabs` 是 sidebar-right 包私有的 observable，快照形状未知，订阅回调可能根本没触发；
- 也可能该换成 `openTab(kind, { replaceTab: activeTabId })` 的替换语义，而不是「先关后开」。
### 10.11 布局宽度固定（2026-11-05）

用户要求「左侧栏、任务列表、右侧栏的宽度每次打开都一样」。实测当前值（截图 2560×1440，1:1 像素即 CSS px，列扫描得出）：**左栏 325 / 待办内分类栏 188 / 右栏 650**。

**根因**：`@deepseek-ai/dsh-client-ui-layout` 的布局 store 是**纯内存**的——`init` 写死 `sidebar: 280`、`rightbar: null`（首次打开取 `viewport × 0.45`），只在拖拽/开关栏时改内存值，**从不写 localStorage**；`ctx.layout`（LayoutController）只暴露 `selectPanel / beginNavigation / toggleSidebar / openRightbar / closeRightbar`，**没有宽度 setter**，也没有对应 Config。所以「每次打开一样」在原 API 下不可能。

**做法**（`plugin/src/client/index.jsx` 的 `pinLayout`）：
- DSH 把三栏宽度写在 AppFrame 的 inline `grid-template-columns`（`${sidebar}px minmax(…,1fr) minmax(0px,${rightbarMax}px)`），这是插件唯一够得着的面。
- 启动时找到该 frame（`#root` 下第一个带 inline `grid-template-columns` 的 div），把 `localStorage['dsh-todo-list.layout.v1']`（`{sidebar,rightbar}`）写回去；没有记录就先记当前值。
- `MutationObserver` 守护 style：宿主每次重写（开合栏、resize）都重新应用；`data-side="sidebar|rightbar"` 的 pointerdown 期间不干预，pointerup 才保存最终值，所以拖拽照常可用。
- 钳制规则照搬 DSH：sidebar 264–420，rightbar 300–`viewport×0.7`。

**注意**：分类栏（`.dstl-sidebar`）是插件 CSS，当前**保持 188**，没有改成之前提过的 208——「每次打开都是这个布局」以当前实测为准。要 208 单独说。

**待验证**：重启后拖左栏/右栏到任意宽度 → 刷新页面（或重开 DSH）→ 宽度是否保持；再开关待办 tab 是否会触发回弹。
### 10.12 右侧栏与待办按钮的分工（2026-11-05）

用户实际诉求：「侧边栏按钮只能开关侧边栏，待办按钮只能开关待办，其中一个打开另一个就关上」。此前用 `preferNewPane:false + revealIfOpened` 只解决了「不并排」，没解决两件事：收起右栏后再点展开，右栏**恢复的是待办 tab**，看起来像侧边栏按钮在开关待办；以及待办按钮只能开不能关。

三处改动（`plugin/src/client/index.jsx`）：

1. **收起右栏即关闭待办 tab**：`TodoBody` 读 `useTabInfo().sidebar.expanded`，变 `false` 时调 `tab.actions.close()`。这样右栏再打开时不会再自动恢复待办页（layout 记录随 tab 一起消失），侧边栏按钮就只负责显隐。
2. **待办按钮变成开关**：`toggleTodoTab` 先 `tabsIn(sessionId)` 找同 kind 的 tab，有就 `close(id)`，没有才打开。
3. **打开时顶掉现有页**：`openTodoTab` 取该会话最后一个非待办 tab，用 `openTab(kind, { replaceTab: target.id, preferNewPane: false, revealIfOpened: true })`——替换而非新开，右栏不会同时持有文件树和待办。

**验证**：①点侧边栏展开 → 出现的是「开始」页而不是待办；②点待办按钮 → 右栏切到待办，文件 tab 被顶掉；③再点待办按钮 → 待办关闭；④收起右栏 → 待办 tab 消失，再展开不会自动回来。
### 10.13 撤销布局接管（2026-11-05）

`pinLayout`（§10.11）实际运行不理想，用户决定不再纠结，**代码已整段删除**（`src/client/index.jsx` 从 `LAYOUT_KEY` 到 `pinLayout` 共约 137 行，连同 `apply` 里的 effect 注册）。三栏宽度回到 DSH 原生行为：每次打开是 `sidebar 280` / 右栏视口 45%，拖拽照旧、但不跨刷新记忆。

`localStorage['dsh-todo-list.layout.v1']` 可能还残留一条旧记录，`pinLayout` 已不再读取，留着无副作用；想清可在页面控制台执行 `localStorage.removeItem('dsh-todo-list.layout.v1')`。

`client.js` 重建为 146477 B。§10.11 的实测值（左 325 / 分类栏 188 / 右 650）仍可作为「用户偏好的参考值」保留。
### 10.14 取消「收起右栏即关待办」（2026-11-05）

§10.12 的第 1 条（`TodoBody` 监听 `sidebar.expanded`、收起时 `tab.actions.close()`）实际把侧边栏按钮变成了待办的关闭器：待办开着时点侧边栏键，右栏收起 → 待办被关；再展开看到的是「开始」页，而不是把待办召唤回来。

**已删除该 effect** 与 `useEffect` 导入，`TodoBody` 回到纯渲染。当前行为：
- 侧边栏按钮只开关右栏，**待办 tab 保留**，收起只是看不见，再展开就回来；
- 待办按钮仍是 toggle（`tabsIn` 找同 kind，有则 `close`，无则打开）；
- 打开待办仍用 `replaceTab` 顶掉右栏现有页。

`client.js` 145753 B（2026-11-05 11:37 重打包后为 147116 B，字节数以 §11.7 为准）。
---

# 11. 当前状态速查（2026-11-05，新会话从这里开始）

> §10 的 10.1–10.14 是**过程记录**（含三次推翻重做）。要动手请只看本节；遇到分歧再回查对应小节。

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

## 11.5 剩余待办

1. **验证最新一轮**（§10.14）：待办开着 → 点侧边栏键收起 → 再展开，待办应原样回来。`client.js` 147116 B 已于 11:37 构建、DSH 已于 11:39 重启加载，**2026-11-05 用户验收通过**。
2. ~~**分类栏宽度**~~ → **2026-11-05 验收通过**：用户重新确认 188 → **208px**，已改 `plugin/src/ui/styles.css` 的 `.dstl-sidebar` 并重建（`client.js` 149206 B）。§10.11 里那条「以当前布局为准」的结论作废。
3. **`task_write` 的 paused 字段**：**属 `DSH任务系统重建计划`，不是本工程**。代码已在（该工程 `client.js` 33 处、`index.js` 8 处），11:39 重启后工具 schema 已暴露 `paused` → 字段已上线，只差在任务面板真操作一次确认。

**暂缺（§10.7 遗留，从未排期；需要时再单独立项）**

4. **整页 `main` 面板形态**：当前只有右侧栏 tab，无整页版。
5. **快捷键**：未做。
6. **差异面板的启动自动检查**：现在只在设置里手动「读取备份并比对」，Electron 版的启动时自动检查没搬进插件。

## 11.6 走过的弯路（新会话不必重走）

- 互斥做过三版：①`close` 其它 tab + 订阅 `openTabs` 反向收起（**完全无效**，`openTabs` 快照形状未知）②`preferNewPane:false + revealIfOpened`（只解决不并排）③最终：`toggle` + `replaceTab` + 不干扰右栏开合（**当前**）。
- 布局接管（`pinLayout`：记 `grid-template-columns` 到 localStorage + MutationObserver 守护）实现后用户实测不理想，**整段删除**。
- 「右栏收起即关待办」加过一次，导致侧边栏键变成待办关闭器，**已删**。
- 四态循环上跳：`markStatusChange` 里无条件 `setJumping` 把落位动画（`translateY(10px)`）用错场景，已拆出 `markRowJump`。

## 11.7 构建记录

| 时间 | 产物 | 说明 |
|---|---|---|
| 2026-11-05 11:37:09 | `client.js` 147116 B（`styles-text.js` 同步重建） | §10.14 删除「收起即关 tab」后的一次重打包。与 §10.14 记录的 145753 B 差 1363 B；同期 `src/client/index.jsx` 有改动，当前内容与 §11.3 描述的行为一致、已核对不含 `sidebar.expanded` 关 tab 逻辑，差异来源未逐行比对。**字节数以本表为准**，§10.14 的 145753 B 是上一版记录。 |

> 记这条的原因：2026-11-05 复盘时发现 §10.14 的字节数与磁盘实际不符，会让人误判「线上跑的是旧版」。以后每次重打包顺手补一行。

## 12. 互斥重做（2026-11-05，已验收）

用户语义：待办按钮与「右侧边栏按钮」是两个独立开关，各自只管自己的；其中一个打开时再开另一个，先关对方再开自身。

宿主事实（`app.asar` 提取，见 `F:\DSH\temp\asar-extract\`）：

- 界面右上角两个入口：`conversation.session.header.corner` 的 **ExpandButton**（仅右栏收起时渲染，点击只 `setExpanded(sessionId, true)`）；插件的待办按钮在 `conversation.session.header.utilities`（order 6）。
- 右栏展开后的收起按钮是 `PanelChrome`（面板右上角，`data-sidebar-right-toggle` → `toggleExpanded`），**硬编码在 SidebarPanel 内，插件完全碰不到**。
- 结论：宿主按钮的点击插件拦不到，互斥只能做**状态补偿**。可覆盖的只有 corner 那个 slot，本轮没用它。

实现（只改 `plugin/src/client/index.jsx` 的 `TodoBody`）：

- 组件收到宿主注入的 `useTabInfo` prop（与 `sidebar-files` 插件同款），读 `sidebar.expanded`。
- 只在 **展开 → 收起** 跳变时调用 `tab.actions.close()` 关闭待办页；挂载时就已收起（恢复布局 / 切会话）不动它，避免误杀。
- 效果：点侧边栏收起 → 待办随之关闭 → 再展开落在默认页；点待办按钮仍是纯开关，`openTodoTab` 用 `replaceTab` 顶掉当前页。
- 构建：`client.js` 148419 B（11:59:25），`node --check` 通过。**需重启 DSH 生效**。

### 12.1 「待办 → 侧边栏」要点两次的根因（2026-11-05 已修）

用户实测：侧边栏 → 待办一步通；待办 → 侧边栏要点两次（先关、再开）。这是宿主两条规则叠加，不是插件的 bug：

1. **展开按钮只在收起时渲染**：`ExpandButton`（头部 corner）开头就 `if (expanded) return null`（client.js:674），所以待办开着时右上角没有那个按钮。
2. **关掉唯一 docked tab 会连带收起右栏**：`closeTab` reducer 在 `soleDockedTab` 时追加 `planSetExpanded(state, false)`（client.js:1165-1179）。待办是唯一页时一关，整列就收起了，于是必须再点一次展开。

**修法（绕开第 2 条，不必碰第 1 条）**：关闭时不走 `close`，改走 `openTab('guide', { replaceTab: 待办id })`。`openTab` 的 plan 是「`planSetExpanded(true)` + 开 guide + 关被替换的 tab」（client.js:1118-1157），这个关闭是 op 而不是 reducer，**不会触发「唯一 tab → 收起」**，所以一按就落到默认页、整列保持展开。

- `toggleTodoTab` 的关闭分支改为 replace；`openTab` 抛错时回退到原来的 `close`。
- 构建：`client.js` 149206 B（12:02:41），`node --check` 通过。**需重启 DSH 生效**。

### 12.2 分类栏 188 → 208（2026-11-05，已验收）

- 按用户确认改 `plugin/src/ui/styles.css` 的 `.dstl-sidebar { width: 188px → 208px }`，其余（内边距 10/5/8、缩进、字号、环尺寸）不动。
- 影响：面板总宽不变时右侧任务列表窄 20px；分类名与计数之间留白变大；「新建分组」输入框跟着变宽 20px。
- 构建：`client.js` 149206 B（12:07:00，与上一版同字节数——`188px`/`208px` 等长，只有内容变），`node --check` 通过；产物里 `width: 208px` 命中、`width: 188px` 已无。
- Electron 版（`src/ui/styles.css`）**未动**，它已冻结；两边从此在这一点上不一致，属预期。

### 12.3 清空测试数据 + 交付包（2026-11-05，已生效）

- **数据**：先把 20 条测试数据备份到 `%APPDATA%\mr-baoyuan-todo\TODO\backups\tasks-2026-11-05T04-09-19-219Z.json`（12735 B），再把 `tasks.json` 覆写成空数组（152 B，`deviceId` 保留）。
- **坑（务必记住）**：Host 半是**内存缓存**——`index.js:165` 的 `let cache = null` + `ensureStore()` 命中即不再读文件。直接改 `tasks.json` 后 `todo_list` 仍返回旧数据，**必须重启 DSH**；重启前面板里任何写操作都会把缓存写回文件、覆盖掉手工改动。
- **交付包（用户选「完整工程包」）**：`F:\DSH\导出\抱怨先生的待办列表_2026-11-05.zip`
  - 96,857 B / 17 个条目 / SHA256 `821A5EC016D9EFF59C9546565AF4BE0219F5CA6C77942D3F6AB1B0FD044ED9C8`
  - 含 `package.json`、`cordis.patch.yml`、`index.js`、`client.js`、`build.mjs`、`lib/`、`locale/`、`icon.svg`、`src/`（client + ui + core）
  - 排除 `src/ui/styles-text.js`（构建产物，`build.mjs` 会重新生成）
  - 校验：zip 内 17 个文件与源目录逐件 SHA256 比对，0 处不符