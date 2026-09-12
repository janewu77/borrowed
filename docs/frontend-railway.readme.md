# 前端 Railway 简单部署指南

当前前端是 Next.js 15 + React 19，使用 **GitHub + Railpack** 部署。无需 Dockerfile。前端新建一个 Railway 服务，与后端分别构建和运行。

核对日期：2026-09-12。本文已重新核对当前源码和 Railway / Railpack / Next.js 官方文档。本地依赖安装、类型检查和生产构建均已通过；尚未执行 Railway 发布或浏览器联调。部署配置与当前代码一致，但业务接口仍有下文列出的不匹配。

## 0. 当前源码状态与功能边界

**此前缺失的 `frontend/lib/` 已恢复，并已被 Git 跟踪。** 当前包含：

```text
frontend/lib/api.ts
frontend/lib/api-types.ts
frontend/lib/dates.ts
frontend/lib/reasons.ts
frontend/lib/sse.ts
```

仓库根目录 `.gitignore` 已有以下例外，无需重复添加：

```gitignore
!frontend/lib/
!frontend/lib/**
```

在 `borrowed` 仓库根目录运行 `git ls-files frontend/lib`，应能列出上述五个文件。Railway 使用的部署分支也必须包含这些文件。

`npm run gen:types` 只会生成 `lib/openapi.generated.ts`，不能代替上述 API、日期和 SSE 实现。

当前源码仍有以下业务接口不匹配，部署成功不会自动解决：

| 功能 | 当前前后端行为 | 验收边界 |
| --- | --- | --- |
| 借衣文字对话 `/find` | 前端发送 `role=borrower`，后端支持创建对话和文字 SSE 请求 | 需要后端配置模型，并完成实际流式联调 |
| 确认预约 | 前端发送自然语言 `Reserve ...` 和 `idempotency_key`；后端 `Turn` 禁止额外字段，且要求 `intent=book`、`garment_id`、`confirmed=true`、对应推荐的 `result_id`，确认请求不能带非空文字 | 当前确认请求会被校验拒绝；需保留 SSE `results.result_id` 并对齐确认协议后验收 |
| 图片上传 | 前端允许附图，后端对话解析设置 `max_files=0` | 当前不支持图片消息，不能作为上线可用功能 |
| 出借对话 `/list` | 前端发送 `role=lender`，后端只接受 `borrower` | 创建对话会返回 422；页面可打开不代表可用 |
| 上架与出借人清单 | 前端调用 `/api/listings/{id}/publish` 和 `/api/lender/{id}/garments`，当前后端没有这些路由 | 当前无法完成上架或加载出借人清单 |

对照源码：`frontend/components/chat/ChatStream.tsx`、`frontend/lib/api.ts`、`frontend/lib/api-types.ts`、`backend/src/borrowed_backend/api/conversations.py`、`backend/src/borrowed_backend/agents/state.py`、`backend/src/borrowed_backend/agents/borrower_graph.py`。以上为本地源码核对结果，线上后端版本仍需另行确认。

## 1. 本地确认能构建

用 Node.js 22 执行：

```bash
cd /Users/jingwu/hackathon-202609/borrowed/frontend
npm ci
npm run typecheck
npm run build
```

本次本地验证：Node.js `v22.22.0`，锁定依赖中的 Next.js `15.5.25`；`npm ci --no-audit --no-fund`、`npm run typecheck`、`npm run build` 均退出成功。构建生成 `/`、`/find`、`/list`，并保留商品详情及出借人清单的动态服务端路由。首次沙箱内依赖安装失败，改为获准的沙箱外安装后通过；类型检查和构建在沙箱内完成。此结果不包含生产服务启动、真实后端请求、浏览器或 Railway 运行验证。

将前端源码、`package.json`、`package-lock.json`、`next.config.ts` 和 TypeScript 配置提交并推送到部署分支。无需提交 `node_modules` 或 `.next`。

仓库中的 `env.local` 缺少开头的点，Next.js 不会按标准 `.env.local` 自动加载它。云端统一使用 Railway Variables；不要把本地环境文件当作云端配置。[Next.js 环境变量说明](https://nextjs.org/docs/pages/guides/environment-variables)

## 2. 新建前端服务

在现有 Railway 项目中选择 **New → GitHub Repo**，选择同一个 `borrowed` 仓库，新增服务，可命名为 `borrowed-frontend`。

在这个前端服务的 Settings 中设置：

| 设置 | 值 |
| --- | --- |
| 部署分支 | 已推送完整前端代码的分支 |
| Root Directory | `/frontend` |
| Builder | `Railpack` |
| Build Command | `npm run build` |
| Start Command | `npm run start -- --hostname 0.0.0.0 --port $PORT` |
| Healthcheck Path | `/` |
| Replicas | 先使用 `1` |

后端服务继续使用 `/backend`，不要把后端服务的 Root Directory 改成 `/frontend`。

Railpack 应直接看到 `package.json` 和 `package-lock.json`。如果分析结果仍是 `backend/`、`frontend/` 等仓库目录，说明前端 Root Directory 尚未生效。云端 `/app` 是构建工具创建的工作目录，对应这里选择的 `frontend` 内容。[Railway 子目录部署](https://docs.railway.com/deployments/monorepo)

此项目通过 Next.js 服务代理 API，使用 `next build` + `next start`，无需改成静态导出，也不要使用 `npm run dev` 上线。[Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/next)

## 3. 添加环境变量

在前端服务 **Variables** 中填写：

```text
RAILPACK_NODE_VERSION=22
RAILPACK_NODE_NPM_INSTALL=npm ci
API_ORIGIN=https://你的后端域名.up.railway.app
```

`API_ORIGIN` 填后端 HTTPS 根地址，不带 `/api`，也不要填前端自己的域名或 `localhost`。`PORT` 由 Railway 注入，不用手动设置。[Railpack Node.js](https://railpack.com/languages/node)

当前 `next.config.ts` 已读取 `API_ORIGIN`，并代理：

```text
浏览器 → 前端域名/api/...    → API_ORIGIN/api/...
浏览器 → 前端域名/images/... → API_ORIGIN/images/...
```

代码中有一个默认后端地址，但建议明确设置变量，避免连接到错误环境。变量在首次构建前配置；修改 `API_ORIGIN` 后重新构建并部署，使构建产物里的 rewrites 更新。[Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)

已确认 `lib/api.ts` 的地址选择逻辑：

- 浏览器端读取 `NEXT_PUBLIC_API_BASE`，未设置时使用空前缀，即同源 `/api/...` 和 `/images/...`。
- 服务端页面读取 `API_ORIGIN`，未设置时使用代码中的默认后端 HTTPS 地址；商品详情和出借人页面使用这一逻辑。
- `next.config.ts` 使用 `API_ORIGIN` 配置同源代理，与服务端 API 默认后端地址一致。

**按本文部署时，不要设置 `NEXT_PUBLIC_API_BASE`，已有非空值应删除。** 这样浏览器请求由 Next.js 同源转发，一般无需额外配置浏览器到后端的 CORS。若设置为后端域名，浏览器会绕过代理，必须另行处理 CORS；当前后端未配置 CORS 中间件。修改此公开变量后也需重新构建，因为 Next.js 会在构建时将其写入浏览器代码。[Next.js 环境变量说明](https://nextjs.org/docs/pages/guides/environment-variables)

当前代码不读取 `NEXT_PUBLIC_API_URL`，设置它不会改变 API 地址。

前端无需 Volume 或数据库，预约持久化仍由后端负责。模型 API Key 等后端密钥应放在后端服务，不要放入浏览器可见的 `NEXT_PUBLIC_*` 变量。

## 4. 部署并生成前端地址

1. 应用配置并点击 Deploy / Redeploy。
2. 确认依赖安装和 `next build` 成功，运行日志显示服务就绪。
3. 在 **Settings → Networking → Public Networking** 点击 **Generate Domain**。
4. 如需指定目标端口，使用日志中与 `$PORT` 一致的监听端口。
5. 打开前端域名，应显示 “More to wear. More to give. More to share.” 和两个入口。

前端健康检查用 `/`。当前前端没有 `/health`，也没有把后端的 `/health` 加入 rewrites；后端健康检查仍直接访问后端域名。[Railway Next.js 指南](https://docs.railway.com/guides/nextjs)

## 5. 验证页面与后端代理

替换以下两个域名，在终端执行：

```bash
export BORROWED_FRONTEND_URL='https://你的前端域名.up.railway.app'
export BORROWED_BACKEND_URL='https://你的后端域名.up.railway.app'

curl --fail-with-body -sS "$BORROWED_BACKEND_URL/health"
curl --fail-with-body -I "$BORROWED_FRONTEND_URL/"
curl --fail-with-body -sS "$BORROWED_FRONTEND_URL/api/garments/search" \
  -H 'Content-Type: application/json' \
  -d '{"city":"Hamburg","sizes_eu":[38],"wear_date":"2026-09-18","limit":1000}'
```

搜索示例沿用后端 `DEMO_DATE=2026-09-16` 的演示配置；使用真实日期时相应调整穿着日期。搜索走的是前端域名，用来确认代理可以访问后端。

再用浏览器验证：

- 首页两个入口 `/find` 和 `/list` 可以打开；`/list` 当前创建对话会失败，仅检查页面路由。
- 搜索返回的 `/images/...` 图片经前端域名能加载。
- `/find` 能创建对话，发送纯文字后看到流式回复，浏览器 Network 中请求没有 4xx/5xx；不能仅凭 HTTP 200 判断成功，还需检查 SSE 中是否有 `error` 事件。
- 商品详情 `/garment/实际商品ID` 能展示，验证服务端 API 请求路径。

后端必须配置 `OPENAI_API_KEY` 和 `OPENAI_MODEL` 才能验证模型对话；缺少配置时可能返回 HTTP 200 的 SSE 流，但其中包含 `LLM_NOT_CONFIGURED` 错误。纯文字对话通过也不代表预约、图片或出借流程通过，具体阻塞见第 0 节。预约协议修复后应使用演示数据验证完整预约和回执；这些操作会写入后端数据。

## 常见问题

| 错误或现象 | 检查与处理 |
| --- | --- |
| Railpack 不知道如何构建 | Root Directory 应为 `/frontend`，部署分支应包含 `package.json` |
| `Module not found: ...lib/api` 等 | 当前本地已包含该模块；检查部署分支是否包含 `frontend/lib` 的五个已跟踪文件 |
| `npm ci` 报 lock 不匹配 | 本地同步 package.json 和 package-lock.json、验证构建后一起提交 |
| 找不到 TypeScript 或构建工具 | 不要将依赖安装配置成忽略 devDependencies，构建需要它们 |
| 启动时找不到 production build | Build Command 应执行 `npm run build`，不能只安装依赖 |
| 页面 502 | 确认 Start Command 使用 `0.0.0.0` 和 `$PORT`，查看运行日志 |
| 前端 `/health` 返回 404 | 前端健康检查用 `/`，后端才使用 `/health` |
| 首页正常但 API 502 | 检查 API_ORIGIN、后端是否健康，变量修改后重新构建 |
| API 404 | 核对后端已部署版本是否有该接口；API_ORIGIN 不应带 `/api` |
| 商品详情请求失败 | 当前服务端已使用绝对地址；检查运行时 API_ORIGIN、后端状态和商品 ID |
| 浏览器跨域错误 | 删除非空 NEXT_PUBLIC_API_BASE 后重新构建，恢复同源代理 |
| `/list` 创建对话返回 422 | 当前后端不接受 lender 角色，需实现或对齐出借功能 |
| 点击 Reserve 返回 422 | 当前确认请求不符合后端 Turn 协议，见第 0 节；调整 Railway 变量无法修复 |
| 附图消息失败 | 当前后端禁止对话文件上传，需对齐图片支持 |
| 对话 HTTP 200 但显示模型配置错误 | 检查 SSE error 内容以及后端 OPENAI_API_KEY / OPENAI_MODEL |
| 流式回复迟迟不出现 | 分别检查浏览器流式请求、前端代理和后端日志；首页健康不能验证 SSE |

本次复查确认源码缺失及忽略规则问题已解决，本地类型检查与生产构建通过。生产服务启动、云端发布和浏览器联调仍须分别验证；第 0 节中的业务接口不匹配解决前，不能将前端发布成功视为完整业务上线。
