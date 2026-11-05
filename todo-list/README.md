# dsh-todo-list · DSH 待办列表

右侧栏常驻「待办列表」标签：分类、分组、五种状态、备份导出，数据按会话落盘。

## 功能

- 分类（日常 / 月度 / 截止日 / 无限）与自由分组
- 五种状态：待办 / 进行中 / 待确认 / 完成 / 废弃
- 右侧栏 tab 常驻，可拖动调宽
- 备份导出：一键导出 JSON，可从备份恢复

## 安装

```bash
dsh plugin --profile <profile> add Zcc50/dsh-rebuild#todo-list
```

或从插件市场「DSH 待办列表」一键安装。

## 兼容性

- 宿主：DSH 0.2.1-rc.3（本机验证）
- 依赖扩展点：`sidebar.right` 槽、`@deepseek-ai/dsh-client-ui-layout` / `-conversation` / `-sidebar-right` 注入

## 文件

`index.js`（Host：HTTP 路由 + 落盘）、`client.js`（UI）、`lib/task-store.js`（数据模型）、`cordis.patch.yml`、`locale/`、`icon.svg`。
