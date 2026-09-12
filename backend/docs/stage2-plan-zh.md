# 阶段 2 实施计划

范围依据：`specs/BACKEND_SPEC.md` 第 7、8 节和 `zh/BORROWER_PLAN.md` 阶段 2。保留现有 src 包结构；不实现阶段 3、lender、MCP、图片、LLM 重排或条件放宽。

1. 增加 BorrowerState、文字槽位提取 schema、OpenAI Responses API 适配层及 LangGraph。缺少日期、城市或尺码时最多追问两个字段；相对日期由代码按 store.today() 解析，不能由模型判断可用性。
2. 复用工具注册表中的搜索与预约；按确定性排序返回结果，解释只能使用实际返回的数据。条件变更清除旧推荐和确认依据。
3. POST /api/conversations 创建 borrower 对话；POST /api/conversations/{id}/turn 接收 JSON 或 multipart text，输出带心跳的 SSE。显式 intent=book、garment_id、confirmed=true 才允许预约，目标必须属于当前条件下曾返回的推荐。模型没有预约工具访问权限。
4. 每个 graph 节点保存对话快照；同一对话串行化。预约沿用现有全局锁及快照；确认请求使用稳定幂等键，重试和重启不会重复预约。
5. 覆盖补槽、推荐、确认门禁、条件变更、无结果、LLM 超时/无效结构、预约冲突、并发、持久化失败及恢复。回归阶段 1 测试。
6. 更新依赖锁文件、中英文 API 使用说明和验收记录。无 API 凭据时以注入的确定性模型验证控制流，明确标注未验证真实 OpenAI Responses API 调用。

模型供应商按本次用户追加要求改为 OpenAI，覆盖原规格的 Anthropic 要求。使用 Responses API 的 Pydantic 结构化输出与文本流；不需要额外的业务命名例外。
