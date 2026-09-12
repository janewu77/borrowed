# 阶段 2：Borrower 对话 API

本阶段实现：文字补槽 → 追问缺失信息 → 搜索与解释 → 显式确认预约 → JSON 持久化。按本次要求使用 OpenAI Responses API，覆盖原规格中的 Anthropic 要求。页面、图片、lender、MCP、LLM 重排和条件放宽不在本阶段范围内。

## 启动

```bash
cd /Users/jingwu/hackathon-202609/borrowed/backend
.venv/bin/python -m pip install -r requirements.lock.txt
export OPENAI_API_KEY='在本机填写你的 API Key'
export OPENAI_MODEL='填写账户可用且支持 Responses 结构化输出的模型 ID'
export LLM_TIMEOUT_S=25
PYTHONPATH=src .venv/bin/python -m borrowed_backend --demo-date 2026-09-16
```

模型 ID 没有硬编码默认值。启动阶段不请求模型；未配置 Key 或模型时，结构化搜索仍可用，对话返回 `LLM_NOT_CONFIGURED` 和 `done`。环境变量由启动进程读取；不自动读取 `.env` 文件。Key 不写入对话快照。

仍只允许一个实例、一个 worker，共享一个 `STATE_DIR`。固定演示日期下，“周五”由代码解析为 `2026-09-18`。相对日期使用 `store.today()`；可用性和所有物流日期由阶段 1 的代码计算。

## API 客户端演示

1. 创建对话：

```bash
curl -sS http://127.0.0.1:8000/api/conversations \
  -H 'Content-Type: application/json' -d '{"role":"borrower"}'
```

返回 HTTP 201：`{"conversation_id":"conv-...","role":"borrower"}`。将实际 ID 填入下列变量：

```bash
CID='conv-填写实际ID'
curl -N "http://127.0.0.1:8000/api/conversations/$CID/turn" \
  -H 'Content-Type: application/json' -d '{"text":"我周五要参加晚宴"}'
```

应收到 `question`，追问城市和 EU 尺码。每次最多两个字段，缺少城市时不会默认成 Hamburg。

2. 补充条件：

```bash
curl -N "http://127.0.0.1:8000/api/conversations/$CID/turn" \
  -F 'text=汉堡，EU 38'
```

返回 `results`（可借商品、代码计算的日期、`result_id`）、`token`（解释）、`done`。颜色、场合和风格用于原有确定性评分，返回最多 20 件，不进行模型二次排序。无结果时返回空 hits 和继续操作提示。

3. 从该次 `results` 中选定商品，提交明确确认：

```bash
curl -N "http://127.0.0.1:8000/api/conversations/$CID/turn" \
  -H 'Content-Type: application/json' \
  -d '{"intent":"book","garment_id":"item-填写实际ID","confirmed":true,"result_id":"填写该次推荐的result_id"}'
```

**这会立即占用商品，不支付、不扣款。** 不提交确认，不会通过对话创建预约。自然语言“帮我预约”、模型提及预约或只选择商品都不能触发写入；当前阶段由 API 客户端显式提交上述确认字段。确认请求不能同时携带文字或修改日期，先发文字修改条件并取得新推荐。

成功返回 `booking_claim.booking`，含 `payment_taken:false`、`status:reserved`、物流日期与预约 ID。仅该事件代表预约成功。原确认 JSON 可原样重试：稳定幂等键保证同一次推荐、同一商品只预约一次，包括进程重启后。

## 状态与事件

| 事件 | 内容 |
| --- | --- |
| `question` | `text`、`fields`；最多两个待补字段 |
| `results` | `hits`、`relaxed:null`、`result_id` |
| `token` | `text`；解释片段 |
| `availability` | `feasibility`、`garment`；预约冲突时的当前事实 |
| `booking_claim` | `booking`；已持久化的预约 |
| `error` | `code`、`message`、`recoverable:true` |
| `done` | `conversation_id`；本轮结束，不代表预约成功 |

SSE 每 15 秒无事件时发送 `: ping`。模型调用默认最多 25 秒，不自动重试，以免隐藏延迟。网络断开会取消未完成的模型工作；已经持久化的预约不会撤销，原确认请求仍可重试。相同对话的 turn 串行执行，不同对话共享原有预约锁。

每一轮文字消息开始时使旧 `result_id` 失效，即便该轮模型失败，也必须重新搜索获得新推荐。条件修正、清除预算、移除日期都会保留在槽位中；不能跨对话或使用未推荐的商品进行对话预约。可用性在真正写入时再次检查，其他对话先占用会返回冲突。

| code | 继续方式 |
| --- | --- |
| `LLM_NOT_CONFIGURED` | 配置服务器的 `OPENAI_API_KEY` 和 `OPENAI_MODEL`，重启后重试 |
| `LLM_TIMEOUT` / `LLM_UNAVAILABLE` / `TURN_FAILED` | 重试消息；如果已经收到 results，可使用其结果明确确认 |
| `INVALID_SLOTS` | 提供明确日期、最后穿着日、城市或 EU 尺码后重试 |
| `CONFIRMATION_REQUIRED` | 重新搜索并提交完整确认字段 |
| `BOOKING_CONFLICT` | 重新搜索或调整条件；不会自动换一件预约 |
| `PERSISTENCE_FAILED` | 修复状态目录后原样重试；如果已经收到 booking_claim，预约已成功 |

HTTP 404 表示对话不存在；422 表示 turn 格式无效；415 表示 Content-Type 不支持。SSE 开始后的业务错误使用 error 事件，HTTP 状态仍为 200。图片上传暂不支持。

`data/state/conversations.json` 每个节点原子保存，存储槽位和推荐确认依据，不存储 API Key 或完整聊天文本。预约仍保存在 `bookings.json`。`DEBUG=true` 时可通过 `GET /api/debug/conversations/{id}` 查看持久化状态；默认返回 404。损坏的对话快照会使启动失败，不会静默清空。

## 验证

```bash
.venv/bin/python -m pytest -q
.venv/bin/python scripts/smoke_stage1.py
.venv/bin/python scripts/smoke_stage2.py
```

阶段 2 smoke 使用真实本地 HTTP/SSE 和进程重启，但模型为脚本内显式注入的固定响应，不验证 OpenAI 在线效果。SDK 测试使用真实 OpenAI Python SDK 和 mock HTTP transport 验证 JSON schema、拒答、无效输出和流式结束状态。真实 OpenAI 验收需要配置凭据后执行上面的文字对话。

接口实现参考：[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)。
