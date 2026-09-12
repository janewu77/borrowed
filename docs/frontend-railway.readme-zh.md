# 前端 Railway 简单部署指南

[English](frontend-railway.readme.md) | 简体中文

当前前端是 Next.js 15 + React 19，使用 **GitHub + Railpack** 部署。无需 Dockerfile。前端新建一个 Railway 服务，与后端分别构建和运行。

文档入口见 [README](README.md)，本地演示见 [本地演示说明](../backend/docs/stage3-usage-zh.md)。

## 0. 部署准备与功能范围

部署分支需要包含 `frontend/lib/` 下的 API、日期、原因、SSE 实现，以及 `api-types.ts` 和生成文件 `openapi.generated.ts`。部署前确认这些文件已提交并推送到部署分支。

`npm run gen:types` 从 `backend/scripts/export_contract.py` 导出的 Pydantic HTTP/SSE 模型生成 `lib/openapi.generated.ts`；`api-types.ts` 引用这些类型。生成需要本地后端 Python 环境，不需要启动服务。Railway 的 `/frontend` 构建使用已提交的生成文件，不在构建时执行跨目录生成。

| 功能 | 当前行为 | 使用说明 |
| --- | --- | --- |
| 借衣文字对话 `/find` | JSON 文字 turn，展示 SSE 追问、推荐、回复和错误 | 需要后端配置 OpenAI Key 和模型，并验证云端对话 |
| 确认预约 | Reserve 打开弹窗；Confirm reservation 提交 intent=book、garment_id、confirmed=true、result_id，不发送非空文字 | 仅 booking_claim 表示成功；已预约商品在占用日期内不可再借 |
| 推荐失效和重试 | 新文字禁用旧推荐；确认失败可保留原请求重试，缺失 done 会报断流 | 后端负责幂等性；冲突后重新搜索，不自动改订 |
| 图片上传 | borrower 图片入口已关闭，后端拒绝文件上传 | 未实现 |
| 出借对话 `/list` | 显示尚未开放提示，不创建 lender 对话 | 未实现 |
| 上架与出借人清单 | 后端没有对应路由，前端保留部分组件和清单页面代码 | 不作为可用功能演示 |

刷新会新建对话，不恢复完整聊天记录；已预约数据保存在后端 JSON 快照中。

## 1. 本地确认能构建

用 Node.js 22 执行：

```bash
cd /Users/jingwu/hackathon-202609/borrowed/frontend
npm ci
npm run typecheck
npm run build
```

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

代码默认后端为 `http://127.0.0.1:8000`，仅用于本地开发。Railway 必须显式设置 `API_ORIGIN`，否则请求会指向前端容器自身的 8000 端口。变量在首次构建前配置；修改 `API_ORIGIN` 后重新构建并部署，使构建产物里的 rewrites 更新。[Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)

`lib/api.ts` 的地址选择逻辑：

- 浏览器端读取 `NEXT_PUBLIC_API_BASE`，未设置时使用空前缀，即同源 `/api/...` 和 `/images/...`。
- 服务端页面读取 `API_ORIGIN`，未设置时使用`http://127.0.0.1:8000`；商品详情和出借人页面使用这一逻辑。
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

- 首页两个入口 `/find` 和 `/list` 可以打开；`/list` 当前显示尚未开放提示，不演示出借流程。
- 搜索返回的 `/images/...` 图片经前端域名能加载。
- `/find` 能创建对话，发送纯文字后看到流式回复，浏览器 Network 中请求没有 4xx/5xx；不能仅凭 HTTP 200 判断成功，还需检查 SSE 中是否有 `error` 事件。
- 商品详情 `/garment/实际商品ID` 能展示，验证服务端 API 请求路径。

后端必须配置 `OPENAI_API_KEY` 和 `OPENAI_MODEL` 才能验证真实模型对话；缺少配置时 HTTP 200 的 SSE 仍可能包含 `LLM_NOT_CONFIGURED`。使用演示数据继续验证：

1. 两个标签页分别输入“我周五要参加晚宴”，再输入“汉堡，EU 38”，都先取得同一商品的推荐。
2. 两边打开 Reserve 弹窗，再依次点击 Confirm reservation；第一边应收到 booking_claim，第二边应显示 BOOKING_CONFLICT。
3. 刷新重新搜索，已预约商品不再出现；后端重部署保留同一 Volume，再验证仍不可借。

这些确认会写入后端数据，不扣款。页面、健康检查或单次文字回复成功均不能代替上述验证。无凭据的固定脚本仅供本地复现，输入限制见 [本地演示说明](../backend/docs/stage3-usage-zh.md)。

## 常见问题

| 错误或现象 | 检查与处理 |
| --- | --- |
| Railpack 不知道如何构建 | Root Directory 应为 `/frontend`，部署分支应包含 `package.json` |
| `Module not found: ...lib/api` 等 | 检查部署分支是否包含 `frontend/lib` 的实现文件及 `openapi.generated.ts` |
| `npm ci` 报 lock 不匹配 | 本地同步 package.json 和 package-lock.json、验证构建后一起提交 |
| 找不到 TypeScript 或构建工具 | 不要将依赖安装配置成忽略 devDependencies，构建需要它们 |
| 启动时找不到 production build | Build Command 应执行 `npm run build`，不能只安装依赖 |
| 页面 502 | 确认 Start Command 使用 `0.0.0.0` 和 `$PORT`，查看运行日志 |
| 前端 `/health` 返回 404 | 前端健康检查用 `/`，后端才使用 `/health` |
| 首页正常但 API 502 | 检查 API_ORIGIN、后端是否健康，变量修改后重新构建 |
| API 404 | 核对后端已部署版本是否有该接口；API_ORIGIN 不应带 `/api` |
| 商品详情请求失败 | 检查运行时 API_ORIGIN、后端状态和商品 ID |
| 浏览器跨域错误 | 删除非空 NEXT_PUBLIC_API_BASE 后重新构建，恢复同源代理 |
| `/list` 提示尚未开放 | 当前只实现 borrower，属于预期行为 |
| 确认预约返回 422 | 检查部署版本，以及实际 JSON 是否包含 intent=book、garment_id、confirmed=true、result_id，且不带非空 text |
| BOOKING_CONFLICT | 商品已被其他对话占用，重新搜索或调整日期 |
| 页面仍有附图入口 | 核对是否部署旧前端；当前 borrower 已关闭上传入口 |
| 对话 HTTP 200 但显示模型配置错误 | 检查 SSE error 内容以及后端 OPENAI_API_KEY / OPENAI_MODEL |
| 流式回复迟迟不出现 | 分别检查浏览器流式请求、前端代理和后端日志；首页健康不能验证 SSE |
