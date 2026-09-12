# 阶段 2 验收记录

日期：2026-09-12。范围：borrower 对话 API；实现前计划见 [stage2-plan-zh.md](stage2-plan-zh.md)，运行方法见 [stage2-usage-zh.md](stage2-usage-zh.md)。模型供应商按本次追加要求改为 OpenAI。

## 已验证

- Python 3.12.5；`.venv/bin/python -m pytest -q`：**70 passed**。包含原阶段 1 测试和新增对话、OpenAI SDK 协议测试。一个 Starlette/AnyIO 的弃用告警，不影响通过。
- `.venv/bin/python -m pip check`：无依赖冲突。锁文件依据本阶段 runtime/test 依赖树生成，包含 OpenAI、LangGraph、python-multipart，不依赖 Anthropic。
- `git diff --check`：通过。业务代码命名和英文注释边界沿用原测试。
- 阶段 1 真实 HTTP 回归：386 件商品，固定查询预约前 22 件可借，预约后 21 件；20 个并发请求只有 1 个成功、19 个冲突；重启与幂等恢复通过；catalog 内容及 mtime 不变。
- 阶段 2 真实 HTTP/SSE 回归：第一句“我周五要参加晚宴”后追问 city、sizes_eu；补充“汉堡，EU 38”后返回 20 件推荐（默认上限）；未确认不创建预约；确认后增加 1 条预约；重启后原确认请求恢复同一预约，不重复占用，商品不再出现在该日期的搜索中。

## 针对性覆盖

| 分支 | 验证 |
| --- | --- |
| 缺少日期、城市、尺码 | 一次最多两个字段；城市不默认猜测 |
| 相对日期 | 固定日期 2026-09-16，周五解析为 2026-09-18；明确下周五为 2026-09-25 |
| 无确认 / 无商品 / 无推荐 / 旧 result_id / 未推荐商品 | 返回 CONFIRMATION_REQUIRED，不预约 |
| 普通文字提出预约 | 不能调用写入；需要结构化确认 |
| 修改条件或模型提取失败 | 旧推荐确认依据失效 |
| 无结果 | 空 results 和可继续操作的提示 |
| 模型缺配置、超时、回复失败 | recoverable error 和 done；追问可降级为固定提示；已返回结果仍可确认 |
| 无效日期和反向穿着区间 | 不创建预约，可通过后续消息修正 |
| 两个对话争抢商品 | 后确认者收到实际 feasibility 冲突 |
| 同一对话并发重复确认 | 四个请求返回同一 booking_id，仅一次新增预约 |
| 预约快照失败 | 回滚预约，原确认可重试 |
| 预约成功后对话快照失败 | booking_claim 仍表明真实成功；重启原确认返回同一预约 |
| 请求格式、multipart、图片、debug | JSON/文字表单可用；图片拒绝；debug 默认关闭 |
| SSE | error 后 done；等待时心跳；文本分块；中断结束状态不会当作完整模型回复 |
| OpenAI SDK | 真实 SDK + mock HTTP transport，验证 strict JSON schema、模型配置、store=false、无模型预约工具、拒答/坏 JSON/不完整输出及 SSE |

## 验证边界

当前环境没有配置 `OPENAI_API_KEY` 或 `OPENAI_MODEL`，**未调用真实 OpenAI 服务**。阶段 2 smoke 的模型是脚本内显式注入的固定响应，证明 HTTP/SSE、业务控制流和持久化，不证明自然语言提取质量、真实模型时延或账户模型访问权限。SDK 协议测试也使用 mock HTTP transport。

配置凭据和模型后，应按使用说明走一遍真实文字对话。阶段 3 页面、浏览器联调、图片、lender、MCP、LLM 重排和复杂条件放宽未实现，也未声称通过验收。服务仍要求单实例、单 worker。
