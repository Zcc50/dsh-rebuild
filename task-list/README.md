# dsh-task-list · DSH 任务列表

对话区左侧常驻任务面板，替掉宿主那套容易被下一轮对话冲掉的 `todo_write`。面板与 agent 读写同一份按会话落盘的列表。

## 功能

- 五态：待办 / 进行中 / 待确认 / 完成 / 废弃（废弃有独立底部 dock，空时也显示）
- 父子结构：父任务状态由子任务推导；完成态默认折叠；折叠指针整合进状态环
- 操作：点环切状态、拖卡片到任意状态节、行菜单（阻塞 / 焦点 / 备注 / 重命名 / 废弃 / 恢复）、新建顶层/子任务
- agent 工具：`task_list` / `task_write`（增量 `task_edit` 语义），支持废弃与结构 warning
- 数据：`~/.dsh/storages/task-list/<sessionId>.json`，原子写、损坏自动备份重建、fork 会带走

## 安装

```bash
dsh plugin --profile <profile> add Zcc50/dsh-rebuild#task-list
```

或从插件市场「DSH 任务列表」一键安装。

> 会禁用宿主自带的 `todo_write`，并把上下文压缩阈值从 0.8 降到 0.4（可在 `cordis.patch.yml` 的 `preset-standard` 段改回）。

## 兼容性

- 宿主：DSH 0.2.1-rc.3（本机验证）
- 依赖扩展点：`conversation.input.dock` 槽、`@deepseek-ai/dsh-client-ui-layout` / `-conversation` 注入

## 文件

`index.js`（Host：HTTP 路由 + 工具）、`client.js`（UI）、`lib/task-store.js`（合并规则）、`lib/task-file.js`（落盘）、`cordis.patch.yml`、`locale/`、`icon.svg`。
