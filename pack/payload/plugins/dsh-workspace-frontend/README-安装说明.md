# 工作区美化（DSH 工作区前端重建）· DSH 插件安装说明

- 版本：0.1.0
- 适用：DSH Web / Desktop（本插件在本机 DSH 0.2.1-rc.3 上开发并验证）
- 插件包名：`@local/dsh-workspace-frontend`
- Loader 行 id：`workspace-frontend`

## 功能

DSH 工作区的侧栏前端重建：在保留宿主会话模型的前提下，重做同一工作区里的会话组织与侧栏视觉。

- 左侧栏「工作区美化」入口：工作区下拉、分组增删改色改名、会话归类、点击打开会话
- 侧栏会话列表改为「工作区 → 分组 → 会话」结构（接管 `sidebar.workspaces`）
- 会话行「⋯」菜单：打开会话 / 重命名 / 移入分组… / 归档（或取消归档）/ 复制 Session ID
- 拖拽归组：按住会话行拖到任意分组（跨工作区亦可），松手即归类；高亮为实线分组框
- 删除工作区（会话落到「无工作区」，可再拖回）与「添加分组」按钮
- 会话行左侧上下文用量环：0% 纯绿 → 100% 纯红，每 10% 一档、饱和度降 45%；会话运行中时环会转圈
- 会话行左侧定时任务时钟：该会话存在活跃自动任务（Host schedule）时显示在上下文环左边
- 上下文占用提醒：当前会话 ≥25% 弹一次轻提示（6 秒自动消失），≥35% 弹警示提示（需点「确定」）；文案按上下文卸载协议——已交付内容落盘留索引指针、需要时按关键词回读，35% 起按「落盘 → 写指针 → 删原文」卸载；阈值与卸载插件对齐（35% 触发、25% 回落），每会话每档只提醒一次（`dsh.context-alert.v1`）
- 工作区标题栏右侧显示**剩余账户余额**（与 设置 → 账号与余额 同源，30 秒刷新；样式同会话金额标签，未登录或读取失败显示 `—`）
- 左右侧栏拖拽调宽：宿主本就支持拖动，这里补上可见把手（竖线 + 方向箭头）
- 分组/移动数据只保存在本机浏览器 `localStorage`（key `dsh.session-groups.v1`），不写会话日志，不改会话文件

## 安装（目标电脑）

插件是纯 JavaScript 的 Client-only bundle：不需要 `node_modules`、不需要构建、不需要联网。对接 DSH 只有两步：把目录放到本机固定位置 → 让 DSH 装它。

### 前置检查

- DSH Desktop 或 `dsh web` 正在运行（本机验证版本 0.2.1-rc.3）
- 能打开任意一个会话（安装要在会话里调工具）

### 方式 A：把 zip 丢给 agent（推荐，最省事）

1. 把 `DSH工作区前端重建_2026-10-28.zip` 放在**任意位置**（下载目录、桌面都行）。
2. 在 DSH 任意会话里发：

> 安装 `<zip 的绝对路径>` 这个插件：解压到 `~/.dsh/plugins/dsh-workspace-frontend`，然后调用 plugin_manager install_bundle，把 application 状态报给我。

agent 会做：

- 解压后确认目录里有 `package.json`、`cordis.patch.yml`、`client.js`、`index.js`、`locale/`
- 调 `plugin_manager`，`action: install_bundle`，`target: <目录绝对路径>`
- 确认返回 `application: applied` 且 `bundle: @local/dsh-workspace-frontend`
- 装完 zip 可以直接删

### 方式 B：手动安装（等效）

1. 解压出 `dsh-workspace-frontend` 文件夹，放到固定位置：
   - Windows：`C:\Users\<用户名>\.dsh\plugins\dsh-workspace-frontend`
   - macOS / Linux：`~/.dsh/plugins/dsh-workspace-frontend`

   > 安装是本地 link（Junction/符号链接）到 `~/.dsh/profiles/<profile>/node_modules`，装完后**不能移动或删除**这个目录，否则插件失效。

2. 在 DSH 任意会话里执行：
   - 工具：`plugin_manager`
   - 动作：`install_bundle`
   - `target`：第 1 步目录的**绝对路径**（例如 `C:\Users\Administrator\.dsh\plugins\dsh-workspace-frontend`）

   也可以直接对 agent 说：「把 `<目录>` 这个插件装到当前 profile」。

3. 刷新页面（`Ctrl+R`）。

### 安装后验证

- 左侧栏出现「工作区美化」图标，点开是分组面板
- 侧栏会话列表变成 工作区 → 分组 → 会话
- 会话行「⋯」菜单有五项；会话行左侧出现上下文用量环，有活跃定时任务的会话还会在环左边显示时钟
- 按住会话行可以拖到任意分组

### 校验文件完整性（可选）

PowerShell：

```powershell
$dir = "$env:USERPROFILE\.dsh\plugins\dsh-workspace-frontend"
Get-Content "$dir\SHA256SUMS.txt" -Encoding UTF8 | ForEach-Object {
  $hash, $name = $_ -split '\s+', 2
  $actual = (Get-FileHash (Join-Path $dir $name)).Hash.ToUpper()
  if ($actual -ne $hash) { "MISMATCH: $name" }
}
"check done"
```

### 升级

- 用新包覆盖插件目录内容（保持目录路径不变），刷新页面即可（link 直接指向源目录）
- 如果是换包名的新版本：先 `remove_bundle` 旧包名，再 `install_bundle` 新目录

### 卸载

- `plugin_manager` → `remove_bundle` → `target: @local/dsh-workspace-frontend`
- 卸载后再删除文件夹；已保存的分组数据仍在浏览器 localStorage 中

### 常见问题

| 现象 | 处理 |
|---|---|
| `install_bundle` 返回 `already-installed` | 先 `remove_bundle` 旧包名，再 `install_bundle` |
| 安装成功但侧栏没变化 | 刷新页面（`Ctrl+R`）；确认返回里 `application: applied` |
| 刷新后仍无入口 | 检查 `~/.dsh/profiles/<profile>/package.json` 的 `dsh.profile.bundles` 是否含 `@local/dsh-workspace-frontend` |
| 插件突然消失 | 插件目录被移动或删除，link 断了；放回原路径再刷新 |
| 改源码不生效 | 确认 `node_modules/@local/dsh-workspace-frontend` 是指向插件目录的 Junction/符号链接 |

## 迁移已保存的分组数据（可选）

分组数据按工作区存于浏览器 localStorage，不随文件夹迁移。

当前电脑（F12 → Console）导出：

```js
copy(localStorage.getItem('dsh.session-groups.v1'))
```

把复制到的 JSON 存成文件，带到目标电脑。

目标电脑（F12 → Console）导入后刷新：

```js
localStorage.setItem('dsh.session-groups.v1', `粘贴导出的 JSON`);
location.reload();
```

## 兼容性说明

插件依赖以下 DSH 公开扩展点；DSH 升级后若这些名称或参数变化，可能需要适配：

- Client slot：`sidebar.panellist`、`main`、`sidebar.workspaces`（shadowing，注册 `priority: -1`）、`sidebar.workspaces.session.menu.item`、`sidebar.workspaces.session.row.action`、`sidebar.session.row.hover`、`shell.overlay`
- 标准 hook：`useWorkspaces`（`WorkspaceSnapshot.sessionIds`、`archivedSessionIds`、`pinnedSessionIds`）、`useSessions`（`byId`、`retainedBy.mainView`）、`useSessionStatus`（`running`）、`useSessionRetainInfo`
- 服务：`ctx.uiWorkspace`（openSession / startSession / archiveSession / unarchiveSession / pickDirectory）、`ctx.workspaces.create`、`ctx.layout.selectPanel`、`ctx.sessions`（using / refreshProjections）、`ctx.remote.schedule`（catalog / `$on('schedule/changed')`，用于会话行时钟）、`ctx.remote.account.getBalance`（工作区标题栏余额）

## 皮肤兼容性

插件不强制依赖任何皮肤插件。配色优先使用宿主 `--dsw-alias-*` 主题 token；拖拽把手与上下文环会读取 dsh-claude-style 的自定义调色板（`--dsh-claude-custom-accent`、`--dsh-claude-custom-canvas-dark`），未启用时回退到内置色。

需要注意：皮肤若按宿主原生 DOM 类名/结构写 CSS，自绘的侧栏浏览区不会被那些选择器命中；token 级定制（配色、字体、圆角）正常继承。

## 已知限制（相对原生侧栏）

- 无拖拽排序、无悬浮详情卡、无按工作区树的嵌套、无内容搜索
- 会话菜单为自绘五项（打开 / 重命名 / 移入分组 / 归档 / 复制 Session ID）；置顶、分叉暂未提供，后续可补
- 空白会话只显示当前那一个
- 侧栏收窄成图标栏时只显示一个「工作区美化」按钮，点击进入分组面板

## 文件清单

- `package.json`、`cordis.patch.yml`
- `index.js`（Host 半，空实现）、`client.js`（全部 UI）
- `locale/en.json`、`locale/zh.json`（插件展示名与描述）
- `icon.svg`
- `HANDOFF-DSH工作区前端重建_2026-10-28.md`（开发记录，可删）
- `SHA256SUMS.txt`（与压缩包同级，校验用）

安装前可用 `SHA256SUMS.txt` 校验文件完整性。
