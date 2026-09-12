# 阶段 3：浏览器演示

页面代码位于 `borrowed/frontend`，沿用现有 Next.js 前端；后端业务仍在 `borrowed/backend`。只实现 borrower。

## 本地启动（真实模型）

终端 1：沿用阶段 2 的 OPENAI_API_KEY、OPENAI_MODEL 配置，凭据只在后端环境变量中。

```bash
cd /Users/jingwu/hackathon-202609/borrowed/backend
export STATE_DIR=/tmp/borrowed-stage3-live-state
PYTHONPATH=src .venv/bin/python -m borrowed_backend --demo-date 2026-09-16
```

终端 2：

```bash
cd /Users/jingwu/hackathon-202609/borrowed/frontend
API_ORIGIN=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000
```

打开 http://127.0.0.1:3000/find 。浏览器通过 Next.js 同源代理访问 API 与图片。`API_ORIGIN` 默认本地 8000；部署时显式设置目标后端并重新构建。`NEXT_PUBLIC_API_BASE` 如已配置会覆盖浏览器目标，本地验收应不设置它。

## 无凭据的固定演示

固定模型仅接受这两个完整输入：`我周五要参加晚宴`、`汉堡，EU 38`。其他输入会显示可恢复的调用错误；尺码快捷按钮也不属于这个固定脚本的输入。自由对话请使用上面的真实模型启动方式。

```bash
cd /Users/jingwu/hackathon-202609/borrowed/backend
PYTHONPATH=src .venv/bin/python scripts/smoke_stage2.py --serve --port 8013 --state-dir /tmp/borrowed-stage3-demo-state
```

```bash
cd /Users/jingwu/hackathon-202609/borrowed/frontend
API_ORIGIN=http://127.0.0.1:8013 npm run dev -- --hostname 127.0.0.1 --port 3013
```

打开 http://127.0.0.1:3013/find 。该模式只替换模型响应；搜索、日期、SSE、确认、锁和 JSON 快照均为实际后端实现。无需 API Key。

## 双窗口演示步骤

1. 打开两个独立标签页，各发送 `我周五要参加晚宴`，再输入 `汉堡，EU 38`。
2. 两边先取得推荐，并选择相同商品点击 Reserve。弹窗列出穿着区间、寄出和送达日，以及“不扣款”的真实占用提示。
3. 第一窗口点击 Confirm reservation，收到后端 booking_claim 后才出现成功回执和预约 ID。
4. 第二窗口再点击 Confirm reservation，应显示 BOOKING_CONFLICT，不能出现成功回执。它仍保留的是预约前推荐，所以可以演示真实写入时的再次检查。
5. 刷新重新搜索，已占用商品不再出现。停止后端后用同一个 state-dir 重启，再搜索，仍然不可借。

只运行一个后端实例、一个 worker。不要让多个实例共享 STATE_DIR。需要全新演示时换一个新的 state-dir；不要清除真实预约目录。

刷新会开始新对话，不恢复完整聊天记录；已预约数据保存在后端。新文字请求会禁用旧推荐，避免使用过期 result_id。冲突后重新搜索，不会自动预约替代商品。

网络断流或服务错误会显示 Retry same request；确认重试保留原 garment_id/result_id，由后端稳定幂等键恢复结果。done 本身不代表成功。收到 booking_claim 后即使后续断流也保留真实成功事实。

## 检查

```bash
cd /Users/jingwu/hackathon-202609/borrowed/backend
.venv/bin/python -m pytest -q
cd ../frontend
npm run gen:types
npm run typecheck
npm test
npm run build
```

`gen:types` 从后端 Pydantic 模型导出 HTTP 与 SSE schema，并生成 `lib/openapi.generated.ts`，不依赖运行中的服务。可用 BACKEND_PYTHON 指定 Python 路径。不要手改生成文件。
