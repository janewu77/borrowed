# 阶段 3 实施计划

范围：复用现有 frontend 的 borrower 页面，接通 backend 阶段 2。保留 OpenAI 配置与单进程 JSON 快照，不实现 lender、图片、MCP 或模型重排。

1. 从 Pydantic 导出 OpenAPI 和 SSE 事件类型，替换前端占位契约。
2. 聊天使用 JSON turn 和 POST SSE。推荐绑定 result_id；新文字使旧推荐失效。预约弹窗明确说明真实占用、不扣款，确认提交 intent、garment_id、confirmed、result_id。只在 booking_claim 时显示成功。
3. 处理启动失败、HTTP 错误、业务错误、空结果和缺失 done 的断流；保留原确认请求重试。每个窗口新建独立对话，刷新重新搜索当前可用性。
4. 保留固定日期 2026-09-16 / 穿着 2026-09-18 的可复现演示，隔离验收状态目录。运行 pytest、类型检查、构建和浏览器双窗口测试，重启后再次搜索。

验收区分：浏览器真实 HTTP/SSE + 真实存储；若使用固定模型响应，明确记录，不视作在线 OpenAI 验收。
