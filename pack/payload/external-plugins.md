# 非自研插件清单（V3）

V3 **不打包**这些插件的本体：包里只留包名、版本、npm 链接和用途。安装时逐项问答是否安装，选装则联网 `pnpm add <包名>@<版本>`（目标机需要联网）。

版本是 2026-11-05 本机验证过的版本；想装最新版把版本号去掉或改成 `latest`。

| 项目 | 包名 | 版本 | npm 链接 | 用途 | 写入 bundles |
|---|---|---|---|---|---|
| encoding | `dsh-fs-encoding` | 1.5.2 | https://www.npmjs.com/package/dsh-fs-encoding | `read`/`write`/`edit` 自动识别 GBK/UTF-16/Big5 等编码 | 是 |
| lsp | `dsh-lsp-actions` | 0.5.17 | https://www.npmjs.com/package/dsh-lsp-actions | `lsp_diagnostics` / `lsp_symbols` 等 | 是 |
| lsp | `brooks-lint` | 1.9.1 | https://www.npmjs.com/package/brooks-lint | 6 个 `brooks-*` 代码审查技能 | 是 |
| lsp | `typescript` | 5.9.3 | https://www.npmjs.com/package/typescript | LSP 运行时（必须是 5.9.x） | 否 |
| lsp | `typescript-language-server` | 6.0.2 | https://www.npmjs.com/package/typescript-language-server | TS 语言服务器 | 否 |
| skin | `dsh-claude-style` | 0.19.5 | https://www.npmjs.com/package/dsh-claude-style | 本机同款配色 / 圆角 / 背景 | 是 |
| pet | `dsh-pet` | 0.3.8 | https://www.npmjs.com/package/dsh-pet | 桌面宠物（本机在用） | 是 |
| persona | `whale-persona` | 0.17.7 | https://www.npmjs.com/package/whale-persona | 人设 / 语气插件 | 是 |
| thinking | `@max-null/dsh-chinese-thinking` | 0.3.1 | https://www.npmjs.com/package/@max-null/dsh-chinese-thinking | 强制中文思考 | 是 |
| market | `dshmarket` | 1.73.1 | https://www.npmjs.com/package/dshmarket | 插件市场面板（注：预设里市场工具默认禁用） | 是 |
| find | `dsh-find-plugins` | 0.3.0 | https://www.npmjs.com/package/dsh-find-plugins | 找插件工具 | 是 |

## 说明

- `typescript` / `typescript-language-server` 是 LSP 的依赖，不进 `bundles`，只在装 `lsp` 时一起 `pnpm add`。
- `dshmarket` 与预设里的 `tool-plugin-manager` / `tool-plugin-market` 被禁用相冲突：想用市场工具，装完在 `cordis.patch.yml` 的 `preset-standard` 段把对应 `disabled: true` 删掉。
- `whale-persona` / `@max-null/dsh-chinese-thinking` 会改 agent 的 prompt 行为，装之前先确认目标机接受。
- 链接若失效，按包名在 npm 搜索；版本用 `pnpm view <包名> version` 查最新。
