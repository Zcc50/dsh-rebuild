# HANDOFF：DSH 工作区前端重建（简称：工作区美化）

> 项目组：DSH Web 插件（Client-only bundle）
> 创建：2026-10-28
> 插件目录（开发版 = 安装版，profile 以 Junction 方式引用）：`C:\Users\12870\.dsh\plugins\dsh-workspace-frontend`
> 包名：`@local/dsh-workspace-frontend`；Loader 行 id：`workspace-frontend`

## 1. 目标

在同一个工作区内，把会话按用户自定义的「分组」组织起来，让一个工作区里的多个互不相关的项目各归其位。

- 作用域：**每个工作区各自一套分组**（用户确认）。
- 入口：**左侧栏图标入口**（`sidebar.panellist`），点开主面板「会话分组」（阶段 A）。
- 阶段 B（**已实施**）：以 priority `-1` 替换原生 `sidebar.workspaces`，自绘「工作区 → 分组 → 会话」列表。

## 2. 当前实现（v0.1.0）

插件是 Client-only bundle：Host 半 `index.js` 只有空 `apply`，所有 UI 在 `client.js`。

注册的 slot（以 `client.js` 末尾 `apply` 为准）：

| slot | id/key | 作用 |
|---|---|---|
| `sidebar.workspaces` | priority `-1` | 自绘浏览器，替换宿主原生列表（工作区 → 分组 → 会话） |
| `sidebar.panellist` | `session-groups`（order 20） | 左侧栏「工作区美化」入口图标 |
| `main` | key `session-groups` | 分组面板（工作区下拉 + 分组卡片 + 会话归类） |
| `sidebar.workspaces.session.menu.item` | `session-groups.move`（order 500） | 「移入分组…」条目（行菜单已自绘，此项保留注册） |
| `sidebar.session.row.hover` | `session-groups.hover`（order 20） | 会话悬停卡片 |
| `shell.overlay` | `session-groups.move-dialog` | 移入分组对话框 |
| `shell.overlay` | `session-groups.rename-dialog` | 重命名对话框 |

- 注入服务：`slots` / `locale` / `uiWorkspace` / `layout` / `workspaces` / `sessions` / `remote` / `remote.schedule`。
- 行首装饰（上下文环、时钟）由 `BrowserSessionRow` 自绘，**不再走** `sidebar.session.row.leading`。

## 3. 数据模型

插件自有数据，**不写 Session 日志**，存在浏览器 `localStorage`：

```
key: 'dsh.session-groups.v1'
{
  version: 1,
  byWorkspace: {
    [workspaceId]: {
      sections: [{ id, name, color }],      // 顺序即显示顺序
      assignments: { [sessionId]: sectionId }
    }
  }
}
```

- 分区色取自 8 色调色板 `PALETTE`（Claude 风暖色系）。
- 工作区 / 会话身份来自 `useWorkspaces`、`useSessions` 标准 hook 的快照。
- 打开会话用 `ctx.uiWorkspace.openSession(sessionId)`。

## 4. 文件地图

```
package.json        bundle 清单（dsh.bundle.patch + dsh.client，exports ./client ./locale ./icon）
cordis.patch.yml    insert 行 id=session-groups
index.js            Host 空 apply
client.js           全部 UI / 状态 / 样式（window.__ModuleLoader__.load 格式）
locale/zh.json      meta.title=会话分组
locale/en.json      meta.title=Session Groups
icon.svg            自绘橙底分组图标
```

## 5. 安装与验证

1. 语法/清单检查（node 路径见下）：
   - `node --check client.js`
   - `node -e "JSON.parse(fs.readFileSync('package.json','utf8'))"`（JSON 必须用 node 直接读文件校验；不要用 PowerShell 管道传中文，会按 GBK 解码坏掉）
2. 安装：`plugin_manager` → `install_bundle`，target = 插件目录绝对路径。
3. 安装结果看返回的 `application`（本次为 `applied`）。
4. 验证注册：`cordis_inspect_query` client `Slots.listSubTree` 查 `sidebar.panellist`、`main`、`sidebar.workspaces.session.menu.item`、`sidebar.session.row.leading`、`shell.overlay`，确认 occupant `active: true`。
5. 页面效果：需人工点侧栏「会话分组」图标 / 会话行「…」菜单确认。

node：`C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`

## 6. 踩坑索引

- **pnpm 虚拟存储错位**：profile 从 restore-staging 恢复后，`node_modules/.modules.yaml` 的 `virtualStoreDir` 指向已不存在的 `profiles/restore-staging-*`，install_bundle 报 `ERR_PNPM_UNEXPECTED_VIRTUAL_STORE`。修复：把该字段改回 `profiles/desktop/node_modules/.pnpm`（备份在 `F:\DSH\temp\modules.yaml.backup`）。改完 install_bundle 成功。
- **pwsh 首次调用返回 0xC0000142**：稍后重试即可，不是命令问题。
- **asar 解析**：header 在 offset 12 是 JSON 长度，JSON 从 offset 16 开始（脚本 `F:\DSH\temp\asar-list.mjs` / `asar-extract.mjs`）。
- **PowerShell 管道传中文给 node**：PS 按默认编码读取 UTF-8 无 BOM 文件导致乱码/JSON 解析失败。校验 JSON 一律用 node 读文件。
- **文本替换引号**：批量替换英文文案时，把 `... workspace's ...` 塞进单引号字符串会破坏语法；英文含撇号用双引号字符串。
- **变量遮蔽致插件崩溃（重要）**：`SessionMarker` 内写 `const cx = 8`（圆点坐标），遮蔽了模块级 `cx()`（className 拼接函数），`cx('dssx-marker', …)` 变成数字调用 → `TypeError` → 整个 `SessionBrowser` 崩、宿主接管侧栏。取证同 createPortal 那次：`Slots.listSubTree` 看 `sidebar.workspaces` 的 `priority -1` 是否 `active: false`。规则：组件内局部坐标变量用 `dotCx/dotCy`，**不要用 `cx` / `cy` / `h`**。
- **皮肤费用接口单位**：`value.cny` 以「元 × 1e6」结算（本例 942400 → 0.9424 元），显示前必须 `/1e6`，否则出现 `¥7557405.36` 这类离谱值。
- **回滚后先查记录**：用户否掉的方向（双层箭头、外包边圆点、半圆平移断缝、scaleY/scaleX 压扁）都已记录在 §10.3，改回前先查，别再试一遍。

## 7. 渲染依据（已确认）

- `sidebar.panellist` 组件 props：`{ size, active }` + 标准 hook（`useWorkspaces`、`useSessions`…）+ 注册 `locale: NS` 后的 `t`。
- 会话菜单项 props：`{ sessionId, displayTitle }` + `useMenuOpenState`（`hookContext`）+ `t`。
- 行首 seat props：`{ sessionId }`；仅在行主状态 idle 时渲染，归档行留空。
- 面板组件可从 `useSessions` 快照的 `retainedBy.mainView` 找当前会话，从 `useWorkspaces().items[].sessionIds` 找所属工作区。
- 主题只用 `--dsw-alias-*` token（Claude 皮肤会覆盖这些 token）；所有 token 都带 fallback 颜色。
