# Railway 部署指南：阶段 1–2

当前后端使用 FastAPI、LangGraph 和 OpenAI Responses API，支持结构化搜索及 borrower 文字对话、明确确认预约和重启恢复。采用 **GitHub + Railpack** 自动构建，无需 Dockerfile，也无需先配置数据库。

本指南包含 Railway 配置和云端验证步骤；本地运行见 [README-zh.md](README-zh.md)，完整对话协议见 [阶段 2 使用说明](docs/stage2-usage-zh.md)。

## 1. 把代码推送到 GitHub

实际 Git 仓库是 `borrowed`，后端位于 `backend`。`backend/requirements.txt` 直接列出完整锁定依赖，与 `requirements.lock.txt` 内容一致。

原部署排错记录中，Railpack 0.39.0 的依赖安装阶段不会自动复制 `requirements.lock.txt`，因此不能只写 `-r requirements.lock.txt`。更新锁文件后，在仓库根目录同步：

```bash
cp backend/requirements.lock.txt backend/requirements.txt
```

将它和后端代码、`data/catalog.json`、`images/item-*.jpg` 一起提交到准备部署的分支。本文编写时尚未提交、推送或执行云端部署。

## 2. 在 Railway 创建服务

打开 [Railway](https://railway.com)，选择 **New Project → Deploy from GitHub repo**，选择对应仓库。

在服务设置中填写：

| 设置 | 值 |
| --- | --- |
| 部署分支 | 你推送后端代码的分支 |
| Root Directory | `/backend` |
| Builder | `Railpack` |
| Build Command | 留空，自动安装依赖 |
| Healthcheck Path | `/health` |
| Replicas | `1`，只使用一个区域 |

**Start Command** 复制下面这一行：

```bash
python -m uvicorn borrowed_backend.main:create_app --factory --app-dir src --host 0.0.0.0 --port $PORT --workers 1
```

明确填写此命令，覆盖现有 Procfile 中固定的 `8000` 端口。不要添加 `--reload` 或增加 worker。

## 3. 添加变量和磁盘

选择后端服务和准备部署的环境，在 **Variables** 中逐项添加，或使用 **Raw Editor** 粘贴以下内容。将 API Key 占位符替换为真实值；这里填写变量名和值，不需要 `export`：

```text
RAILPACK_PYTHON_VERSION=3.12
DEMO_DATE=2026-09-16
STATE_DIR=/state
OPENAI_API_KEY=替换为你的真实API Key
OPENAI_MODEL=gpt-4.1-mini
LLM_TIMEOUT_S=25
DEBUG=false
```

| 参数 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | 后端请求 OpenAI 的凭据，只在 Railway Variables 中填写真实值 |
| `OPENAI_MODEL` | 模型 ID，沿用本地演示的 `gpt-4.1-mini`；需账户可访问 |
| `LLM_TIMEOUT_S` | 每次模型调用的超时秒数，默认 25，允许大于 0 且不超过 120 |
| `DEBUG` | 默认 false，关闭对话状态调试接口 |

变量变更会进入待部署变更，需要应用并部署后才对运行中的服务生效。[Railway 变量说明](https://docs.railway.com/variables)

本机终端的 `export` 不会同步到 Railway；当前程序也不会自动读取 `.env`。不要把真实 Key 写进代码、README 或提交到 Git。模型名称没有代码默认值；缺少 Key 或模型时，对话返回 `LLM_NOT_CONFIGURED`，但服务启动和 `/health` 仍可能正常。

`PORT` 由 Railway 提供，无需填写。商品目录和图片使用源码中的默认路径，无需额外配置。`DEMO_DATE` 固定演示日期，配合下面 9 月 18 日的搜索；以后需要真实日期时再删除该变量。

在项目画布右键菜单中创建 **Volume**，连接这个后端服务，**Mount Path 填 `/state`**。

运行数据分别保存在：

- `/state/bookings.json`：预约和幂等请求。
- `/state/conversations.json`：对话槽位和推荐确认依据。

仅设置 `STATE_DIR` 不会自动创建磁盘，必须挂载 Volume 才能在重新部署后保留数据。当前实现必须保持单实例、单 worker。

## 4. 部署并生成地址

1. 应用以上设置，点击 **Deploy / Redeploy**。初次自动部署若发生在设置完成前，配置好后重试即可。
2. 查看日志，确认 Uvicorn 正常启动，健康检查通过。
3. 在 **Settings → Networking → Public Networking** 点击 **Generate Domain**。
4. 如需填写目标端口，使用启动日志里实际监听的端口，与 `PORT` 一致。
5. 打开生成域名下的 `/health` 和 `/docs`。

例如：

```text
https://你的域名.up.railway.app/health
https://你的域名.up.railway.app/docs
```

`/health` 应返回 `status: ok`、`today: 2026-09-16`。它不请求 OpenAI，不能证明 Key、额度或模型调用可用；需要继续完成下方对话验证。根路径 `/` 返回 404 正常，这个后端没有首页。

## 5. 验证结构化搜索

在本机终端替换域名后运行：

```bash
export BORROWED_API_URL='https://你的域名.up.railway.app'
curl --fail-with-body -sS "$BORROWED_API_URL/health"
curl --fail-with-body -sS "$BORROWED_API_URL/api/garments/search" \
  -H 'Content-Type: application/json' \
  -d '{"city":"Hamburg","sizes_eu":[38],"wear_date":"2026-09-18","limit":1000}'
```

搜索应返回商品数组。这个接口不调用模型，可先用它区分后端部署问题与模型调用问题。

## 6. 验证真实 OpenAI 对话和 SSE

继续使用上一步的 `BORROWED_API_URL`。先创建对话：

```bash
curl --fail-with-body -sS "$BORROWED_API_URL/api/conversations" \
  -H 'Content-Type: application/json' -d '{"role":"borrower"}'
```

将返回的 conversation_id 填入变量，再发送文字：

```bash
BORROWED_CONVERSATION_ID='conv-替换为返回的ID'
curl --fail-with-body -N "$BORROWED_API_URL/api/conversations/$BORROWED_CONVERSATION_ID/turn" \
  -H 'Content-Type: application/json' -d '{"text":"我周五要参加晚宴"}'
```

固定演示日期下，应解析为穿着日 `2026-09-18`，并通过 `question` 追问城市和 EU 尺码。继续补充：

```bash
curl --fail-with-body -N "$BORROWED_API_URL/api/conversations/$BORROWED_CONVERSATION_ID/turn" \
  -H 'Content-Type: application/json' -d '{"text":"汉堡，EU 38"}'
```

应收到 `results`（可借商品、实际日期、`result_id`）、`token`（解释）和 `done`。`curl -N` 禁用客户端输出缓冲；后端等待期间每 15 秒无事件时发送 `: ping`。HTTP 200 或 done 只表示流正常结束，仍需检查是否含 error，不能据此判定模型调用或预约成功。

目前只支持文字；即使所选模型支持视觉，当前 turn 接口也拒绝图片上传。

## 7. 明确确认预约，并验证跨部署恢复

从当前对话的 results 中选定一个商品，将对应 ID 和 result_id 填入以下 JSON。**这一步会创建真实的演示占用，不支付、不扣款。** 普通文字“帮我预约”不会触发对话预约，必须提交明确确认字段。

```bash
curl --fail-with-body -N "$BORROWED_API_URL/api/conversations/$BORROWED_CONVERSATION_ID/turn" \
  -H 'Content-Type: application/json' \
  -d '{"intent":"book","garment_id":"item-替换为选中的ID","confirmed":true,"result_id":"替换为该次results的ID"}'
```

1. 保存 conversation_id、完整确认 JSON，以及 `booking_claim.booking` 的响应。只有 booking_claim 表示预约已成功保存。
2. 重新搜索相同日期，该商品应不再返回。
3. 重新部署同一个服务，保持原 Volume、`STATE_DIR` 和 `DEMO_DATE`。
4. 使用同一 conversation_id 直接重发原确认 JSON，应返回同一个 booking_id，且 `already_existed:true`；搜索仍不能借到它。

恢复验证时不要先发新的文字消息：每个文字 turn 都会使旧 result_id 失效。确认请求不能同时带文字修改条件；需要改日期、城市或尺码时，先发文字获取新 results，再确认。两个对话竞争同一商品时，后确认者会收到 availability 与 BOOKING_CONFLICT，不会自动改订其他商品。

也可继续使用阶段 1 的 `POST /api/bookings` 验证结构化预约；其完整字段见 [README-zh.md](README-zh.md)。

## 常见问题

| 现象 | 先检查 |
| --- | --- |
| 构建找不到依赖文件 | Root Directory 是否为 `/backend`，requirements.txt 是否直接包含完整依赖列表且已推送 |
| 找不到 Python 模块 | 启动命令是否包含 `--app-dir src` |
| 502 或健康检查失败 | 启动日志、`0.0.0.0`、`$PORT` 和 `/health` |
| 重部署后预约或对话丢失 | Volume 是否连接原服务，挂载路径是否为 `/state` 且与 `STATE_DIR` 一致 |
| `LLM_NOT_CONFIGURED` | 是否在当前 Railway 服务及环境配置两个 OPENAI 变量，并已应用部署 |
| `LLM_TIMEOUT` | 每次模型调用是否超过 LLM_TIMEOUT_S；结合模型和网络情况排查，可按需调整超时 |
| `TURN_FAILED` / `LLM_UNAVAILABLE` | 检查 Key 有效性、账户额度、模型权限与服务连通性；错误码本身不会区分这些原因 |
| `CONFIRMATION_REQUIRED` | 商品是否来自当前对话，result_id 是否为最新，是否显式 confirmed=true |
| `PERSISTENCE_FAILED` | 检查 Volume 挂载、可写性和容量；若已收到 booking_claim，预约已成功，原确认可重试 |
| HTTP 200 但对话失败 | 查看 SSE 中的 error 事件；HTTP 200 和 done 不代表业务成功 |
| curl 成功但前端请求失败 | 当前代码没有 CORS 配置；不同域名的浏览器前端需要补允许来源的配置，或使用同源代理 |

当前后端没有登录鉴权、支付或取消预约，适合先跑通 Hackathon 演示。

本地阶段 2 的测试和真实 HTTP/SSE 冒烟记录见 [验收记录](docs/stage2-acceptance-zh.md)。该冒烟使用固定模型响应，不证明真实 OpenAI 效果。本文已核对当前源码以及 Railway 变量、启动命令和 Volume 文档；本次仅更新部署说明，未执行 Railway 云端构建、发布、在线模型调用或持久化验证。

参考：[Railpack Python](https://railpack.com/languages/python)、[Railway 启动命令](https://docs.railway.com/deployments/start-command)、[子目录部署](https://docs.railway.com/deployments/monorepo)、[持久化磁盘](https://docs.railway.com/volumes)。

构建排错依据：[Railpack 0.39.0 Python 源码 copyInstallFiles](https://github.com/railwayapp/railpack/blob/v0.39.0/core/providers/python/python.go#L401-L428)。
