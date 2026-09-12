# 阶段 3 验收记录

日期：2026-09-12。范围：现有 Next.js borrower 页面与阶段 2 后端联调。

## 已实现

- 从 Pydantic 生成 HTTP/SSE 类型；results 携带 result_id，error 携带 code。
- JSON 对话请求，流式文本、追问、商品卡、空结果与调用错误展示。
- Reserve 打开确认弹窗；Confirm reservation 提交 intent=book、confirmed=true、garment_id、result_id。弹窗说明真实占用且不扣款；未收到 booking_claim 不显示成功。
- 新文字请求禁用旧推荐；成功或冲突也禁用该轮推荐。请求过程中禁止重复提交。
- HTTP 错误、缺失 done、损坏 JSON 显式报错；原确认请求可重试，幂等性由后端保障。
- 刷新开始新对话；预约继续由后端快照保存。关闭未实现的图片入口。
- 默认 API 代理改为本地 8000，远程部署必须显式配置目标。

## 自动检查

- 后端 pytest：70 passed，1 个 Starlette/AnyIO 弃用警告。
- 前端 npm run typecheck：通过。
- npm run build：生产构建通过。
- npm test：4 passed，覆盖逐字节中文 UTF-8/CRLF、heartbeat、正常 done、缺失 done、损坏事件及 BOOKING_CONFLICT 后的 done。
- git diff --check：通过。

## 浏览器实际联调

使用 Codex 浏览器两个独立标签页，页面 `http://127.0.0.1:3013/find`，Next.js 代理到 `http://127.0.0.1:8013`。

后端通过 `scripts/smoke_stage2.py --serve` 注入固定模型，日期为 2026-09-16，独立快照目录 `/tmp/borrowed-stage3-browser-state`。搜索、可用性、锁、预约与磁盘写入均为真实后端代码。

1. 输入“我周五要参加晚宴”：页面追问 city、sizes_eu。
2. 补充“汉堡，EU 38”：出现 20 张推荐卡，两窗口均包含 Fella Burgundy Dress / item-0066。
3. 两窗口先打开同一商品弹窗，穿着 2026-09-18 至 2026-09-21；寄出 2026-09-16，送达 2026-09-17。
4. 第一窗口确认：显示预约回执 `bk-a3c98069`，商品 `item-0066`，no payment taken。
5. 第二窗口确认：显示 `BOOKING_CONFLICT: 该商品当前无法预约，请重新搜索或调整日期。` 和后端可用性时间线，无成功回执。
6. 第二窗口刷新，重新完成相同搜索：item-0066 对应卡片数量为 0。
7. 停止原后端进程，使用相同目录重启；再次在浏览器完成相同搜索：仍有 20 张推荐卡，item-0066 数量为 0。
8. 读取 bookings.json：reservations 仅 1 条，booking id 为 bk-a3c98069，hold_from=2026-09-16，hold_to=2026-09-24。
9. 页面截图确认商品图片、按钮及回执展示；修复发现的整页滚动问题，后续截图确认头部和输入框固定、内容在聊天区域滚动。浏览器错误日志为空。
10. 固定脚本不接受 “My EU size is 38”，页面实际显示 TURN_FAILED 与 Retry same request；发送受支持的完整输入后可继续搜索。

## 验收边界

这次验证了真实浏览器 + HTTP/SSE + JSON 快照，未调用在线 OpenAI；不声称真实模型自由对话已验收。两窗口是先取得相同推荐、再依次确认的冲突场景；锁的同时并发竞争由现有后端测试覆盖。

页面刷新不恢复完整聊天文本。未覆盖 lender、MCP、上传、支付、部署或生产多进程；仍限定单实例、单 worker。固定模型演示的输入限制和真实模型启动方式见 stage3-usage-zh.md。
