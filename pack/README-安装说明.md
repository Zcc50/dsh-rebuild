# DSH 重修整合包 V3 · 安装说明

> 版本：2026-11-05（V3）| 适用：Windows + DSH Desktop / `dsh web`（本包在 DSH 0.2.1-rc.3 上验证）
> 一句话：工作区美化、任务列表 0.3.14、待办列表、心理档案框架、视觉、编码、LSP/审查、皮肤——**每一项都先问你**，你确认或修改后才装；非自研插件只给包名与链接，装的时候联网下载。

## 一、包含什么

### 自研插件（包内带完整源码，不联网也能装）

| 项目（卡片名） | 内容 | 装好后你会看到 |
|---|---|---|
| `workspace` 工作区美化 | `@local/dsh-workspace-frontend` 0.1.0 | 侧栏「工作区 → 分组 → 会话」、拖拽归组、上下文用量环、20%/40% 上下文提醒 |
| `tasklist` 任务列表 | `@local/dsh-task-list` **0.3.14** | 对话左侧任务面板、五态（含废弃）、父子折叠、完成区/废弃区 dock、`task_edit` 增量工具 |
| `todolist` 待办列表 | `@local/dsh-todo-list` **0.1.0** | 右侧栏「待办列表」标签：分类/分组/五态、备份导出 |
| `vision` 视觉 | `dsh-vision` 0.1.0 | `analyze_image` 识图、`screenshot` 截屏（需自备 `vision.env`） |

### 文件类选装

| 项目（卡片名） | 内容 | 说明 |
|---|---|---|
| `psych` 心理档案 | 框架：00-总纲 + 12 大类条目 + 模板 + 各级索引（234 个文件） | **只带框架，不带任何个人记录**（`_记录` / `_日报` / `_底色` / `输入记录` 均不含）；安装时问答确定**目标用户名**与**安装路径** |

### 非自研插件（包里不带本体，只给包名 / 版本 / 链接，装时联网 `pnpm add`）

| 项目 | 包 | 版本 | 用途 |
|---|---|---|---|
| `encoding` 编码 | `dsh-fs-encoding` | 1.5.2 | read/write/edit 自动识别 GBK/UTF-16/Big5 |
| `lsp` LSP + 审查 | `dsh-lsp-actions` + `brooks-lint` + `typescript` + `typescript-language-server` | 0.5.17 / 1.9.1 / 5.9.3 / 6.0.2 | `lsp_diagnostics` 等 + 6 个 brooks 审查技能 |
| `skin` 皮肤 | `dsh-claude-style` | 0.19.5 | 本机同款配色 / 圆角 / 背景 |
| `pet` 桌宠 | `dsh-pet` | 0.3.8 | 桌面宠物 |
| `persona` 人设 | `whale-persona` | 0.17.7 | 人设 / 语气插件 |
| `thinking` 中文思考 | `@max-null/dsh-chinese-thinking` | 0.3.1 | 强制中文思考 |
| `market` 插件市场 | `dshmarket` | 1.73.1 | 市场面板（预设里市场工具默认禁用） |
| `find` 查找插件 | `dsh-find-plugins` | 0.3.0 | 找插件工具 |

完整链接清单见 `payload\external-plugins.md`。

### 白皮书

| 项目 | 内容 |
|---|---|
| `agents` 白皮书 | `AGENTS.md` 2026-11-05 版（含第⑨条休息、任务系统增量维护等）——安装时由你选：覆盖 / 只补缺失章节 / 不动 |

> 出入库等业务项目不属于环境包，不在这里。

## 二、先决条件

1. Windows 10/11，已安装 DSH（Desktop 或 `dsh web`）。
2. **DSH 至少启动过一次**，`%USERPROFILE%\.dsh\profiles\<profile>\package.json` 存在。
3. 不需要 `F:\DSH` 目录、不需要在 PATH 里有 node。
4. **装非自研插件需要联网**（`pnpm` 从 registry 拉包）；自研插件与心理档案不需要联网。

## 三、安装（推荐：让 DSH 里的 agent 装，逐项确认）

1. 把 zip 解压到任意位置（例如桌面），得到 `DSH重修_V3_2026-11-05\` 文件夹。
2. 在 DSH 任意会话里发：

   > 按 `<解压目录>\安装指令.md` 安装重修整合包 V3。

3. agent 会**逐项出问答卡片**（工作区美化 / 任务列表 / 待办列表 / 视觉 / 心理档案 / 编码 / LSP / 皮肤 / 桌宠 / 人设 / 中文思考 / 市场 / 查找 / 白皮书），你可以：
   - 直接确认推荐项；
   - 说「不装 LSP」「皮肤不要」「心理档案不装」这类修改，agent 会按你的选择拼安装命令；
   - 心理档案会额外问你两件事：**目标用户名**（替换文中的占位符）和**安装路径**；
   - 装完后让你重启 DSH。
4. 完全退出 DSH（含后台进程）再启动，刷新页面。

## 四、安装（手动，等价）

```powershell
# 只看计划不动文件
powershell -NoProfile -ExecutionPolicy Bypass -File "<解压目录>\install.ps1" -Include "workspace,tasklist,todolist,psych,encoding,lsp,vision" -DryRun

# 按需组合（逗号分隔）
powershell -NoProfile -ExecutionPolicy Bypass -File "<解压目录>\install.ps1" -Include "workspace,tasklist,todolist,encoding,lsp,vision"

# 加心理档案（指定路径与用户名）
powershell -NoProfile -ExecutionPolicy Bypass -File "<解压目录>\install.ps1" -Include "psych" -PsychDest "D:\档案\心理档案" -UserName "李明"

# 加皮肤、外置插件与白皮书
powershell -NoProfile -ExecutionPolicy Bypass -File "<解压目录>\install.ps1" -Include "skin,pet,agents" -AgentsPolicy overwrite
```

可选项目：`workspace tasklist todolist vision psych encoding lsp skin pet persona thinking market find agents`
不传 `-Include` 时默认装 `workspace,tasklist,todolist,psych,encoding,lsp,vision`（不含皮肤、桌宠等外置插件，不动白皮书）。
`-AgentsPolicy` 取值：`keep`（默认，不动）/ `overwrite`（备份后覆盖）/ `append`（只补缺失章节）。
`-PsychDest` 不传时默认 `<我的文档>\心理档案`；目录已存在会**跳过**，避免覆盖已有记录。

## 五、验证清单

重启后逐项确认（装了哪项就查哪项）：

- [ ] 左侧栏出现「工作区美化」入口，会话列表是 工作区 → 分组 → 会话
- [ ] 会话行左侧有上下文用量环；有定时任务的会话旁边有时钟
- [ ] 对话区左侧出现任务面板；五态齐全；底部有「废弃」与可收起的「已完成」dock
- [ ] 右侧栏出现「待办列表」标签，能建分类 / 分组 / 五态任务
- [ ] 任务面板 / 待办列表的数据在 `~/.dsh/storages/` 下按会话落盘，刷新不丢
- [ ] 让 agent 读一个 GBK 文件：`read` 不再报 `E_NOT_TEXT`，中文正常
- [ ] 打开任意 `.ts` 文件让 agent 调 `lsp_diagnostics`，返回诊断而不是 `LSP_ACTION_SERVER_FAILED`
- [ ] 会话技能目录里出现 6 个 `brooks-*` 技能
- [ ] （装了心理档案）目标路径下出现 `心理档案\` 框架，`00-总纲\每日评估流程.md` 里的用户名已是目标用户
- [ ] （装了视觉）`analyze_image` 能识图；否则按 §六 配 `vision.env`
- [ ] （装了皮肤）界面配色变成 DeepSeek 蓝 + 本机同款布局
- [ ] （装了白皮书）`~/.dsh/AGENTS.md` 含第⑨条「休息」

## 六、视觉插件配置（`vision.env`）

视觉的识图走外部视觉模型，Key 不在包里。装好后在 `%USERPROFILE%\.dsh\vision.env` 写入：

```ini
DSH_VISION_BASE_URL=https://open.bigmodel.cn/api/paas/v4
DSH_VISION_MODEL=glm-4.6v-flash
DSH_VISION_API_KEY=<你的 Key>
```

（也可直接从旧机把 `~/.dsh/vision.env` 拷过来。）没有 Key 时 `analyze_image` 会报错，但不影响其它模块。

## 七、卸载 / 回滚

- 卸载：在 DSH 里让 agent 对对应包名执行 `plugin_manager` → `remove_bundle`：
  `@local/dsh-workspace-frontend`、`@local/dsh-task-list`、`@local/dsh-todo-list`、`dsh-vision`、`dsh-fs-encoding`、`dsh-lsp-actions`、`brooks-lint`、`dsh-claude-style`、`dsh-pet`、`whale-persona`、`@max-null/dsh-chinese-thinking`、`dshmarket`、`dsh-find-plugins`；
  再删 `~/.dsh/plugins\<同名目录>`。
- 回滚：安装前自动备份在 `%USERPROFILE%\.dsh\backup-重修-<时间戳>\`，把 `package.json`、`cordis.patch.yml`、`AGENTS.md` 覆盖回去，重启 DSH。
- 心理档案：直接删 `-PsychDest` 指向的目录即可（框架不含个人记录，但目标机上新增的记录会一起删，删前确认）。

## 八、常见问题

| 现象 | 处理 |
|---|---|
| 安装报「未找到可用 profile」 | DSH 还没启动过；启动一次再装 |
| 安装报「未找到 DSH runtime 的 node/pnpm」 | DSH 安装不完整；重装 DSH |
| `pnpm add` 失败 / 装外置插件报错 | 需要联网：检查网络 / 代理 / registry 后重跑 |
| 装了没有任何变化 | 是否完全退出并重启了 DSH（只刷新页面不够） |
| 任务面板不出现 | 检查 `<profile>\package.json` 的 `dsh.profile.bundles` 是否含 `@local/dsh-task-list` |
| 待办列表不出现 | 检查 bundles 是否含 `@local/dsh-todo-list`；右侧栏是否被隐藏 |
| 心理档案没出现 | 看安装输出里的 `心理档案: <路径>`；目标目录已存在时会跳过 |
| 心理档案里的用户名没替换 | 安装时是否传了 `-UserName`；不传则用 Windows 用户名 |
| 皮肤没生效 | `-Include` 里是否含 `skin`；`cordis.patch.yml` 是否含 `ui-skin-claude-style` 段 |
| LSP 报 `LSP_ACTION_SERVER_FAILED` | 确认 `typescript` 是 5.9.x（7.x 没有 `lib/tsserver.js`） |
| 想用插件市场但工具被禁 | `cordis.patch.yml` 的 `preset-standard` 段里删掉 `tool-plugin-manager` / `tool-plugin-market` 的 `disabled: true` |

## 九、包里有什么

```
DSH重修_V3_2026-11-05\
├─ install.ps1                 逐项安装（-Include / -AgentsPolicy / -PsychDest / -UserName / -DryRun）
├─ README-安装说明.md           本文件
├─ 安装指令.md                  给 DSH agent 的 SOP（逐项卡片话术在里面）
├─ SHA256SUMS.txt              全包哈希
└─ payload\
   ├─ plugins\                 4 个自研插件源码（workspace / tasklist 0.3.14 / todolist 0.1.0 / vision）
   ├─ psych\心理档案\           心理档案框架（234 文件，不含个人记录）
   ├─ profile\cordis.patch.fragment.yml
   ├─ AGENTS.md                2026-11-05 版白皮书
   ├─ external-plugins.md      非自研插件清单（包名 / 版本 / 链接 / 用途）
   └─ docs\                    HANDOFF 与 P1/P2/P3 报告（只读参考）
```
