# DSH 重修整合包

DSH（DeepSeek Harness）的自用整合包仓库，四部分：

| 目录 | 内容 | 安装 |
|---|---|---|
| 根目录 | 工作区美化插件 `dsh-workspace-frontend` 0.1.1 | 插件市场搜「DSH 工作区前端重建」，或 `dsh plugin --profile <profile> add Zcc50/dsh-rebuild` |
| `pack/` | 整套环境安装器 **V3.1（2026-11-05）**：工作区美化 / 任务列表 0.3.19 / 待办列表 1.4.0 / 视觉 / 心理档案框架 / 编码 / LSP / 皮肤 / 白皮书 | 解压后按 `pack/安装指令.md`，或 `pack/install.ps1` |
| `task-list/` | 任务列表插件 `dsh-task-list` **0.3.19** | 市场搜「DSH 任务列表」，或 `dsh plugin --profile <profile> add Zcc50/dsh-rebuild#task-list` |
| `todo-list/` | 待办列表插件 `dsh-todo-list` **1.4.0** | 市场搜「DSH 待办列表」，或 `dsh plugin --profile <profile> add Zcc50/dsh-rebuild#todo-list` |

## 安装器（pack/）

见 `pack/README-安装说明.md`。V3 的非自研插件（编码 / LSP / 皮肤 / 桌宠 / 人设 / 中文思考 / 市场 / 查找）只给包名与 npm 链接，安装时联网 `pnpm add`。

## 版本

- 2026-11-05：V3——任务列表 0.3.19、待办列表 1.4.0 入包；新增心理档案框架（选装，用户名问答替换）；非自研插件改为链接 + 问答、不再打包 tgz。
- 2026-10-31：V2——工作区美化上架市场；pack 首次成包。
