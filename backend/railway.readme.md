# Railway 简单部署指南

当前后端使用 FastAPI。采用 **GitHub + Railpack** 自动构建，无需 Dockerfile，也无需先配置数据库。

## 1. 把代码推送到 GitHub

实际 Git 仓库是 `borrowed`，后端位于 `backend`。`backend/requirements.txt` 直接列出完整锁定依赖，与 `requirements.lock.txt` 内容一致。

Railpack 0.39.0 的依赖安装阶段不会自动复制 `requirements.lock.txt`，因此不能只写 `-r requirements.lock.txt`。更新锁文件后，在仓库根目录同步：

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

在服务 **Variables** 添加：

```text
RAILPACK_PYTHON_VERSION=3.12
DEMO_DATE=2026-09-16
STATE_DIR=/state
```

`PORT` 由 Railway 提供，无需填写。商品目录和图片使用源码中的默认路径，无需额外配置。`DEMO_DATE` 固定演示日期，配合下面 9 月 18 日的搜索；以后需要真实日期时再删除该变量。

在项目画布右键菜单中创建 **Volume**，连接这个后端服务，**Mount Path 填 `/state`**。

预约会保存在 `/state/bookings.json`。仅设置 `STATE_DIR` 不会自动创建磁盘，必须挂载 Volume 才能在重新部署后保留数据。当前实现必须保持单实例、单 worker。

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

`/health` 应返回 `status: ok`、`today: 2026-09-16`。根路径 `/` 返回 404 正常，这个后端没有首页。

## 5. 验证搜索和数据保存

在本机终端替换域名后运行：

```bash
export BORROWED_API_URL='https://你的域名.up.railway.app'
curl --fail-with-body -sS "$BORROWED_API_URL/health"
curl --fail-with-body -sS "$BORROWED_API_URL/api/garments/search" \
  -H 'Content-Type: application/json' \
  -d '{"city":"Hamburg","sizes_eu":[38],"wear_date":"2026-09-18","limit":1000}'
```

搜索应返回商品数组。要确认预约能跨部署保存：

1. 在 `/docs` 使用搜索返回的商品 ID 调用 `POST /api/bookings`，填写城市、尺码、穿着日期和唯一的 `idempotency_key`。
2. 保存完整请求与响应。这一步会实际创建一笔演示预约。
3. 重新部署同一个服务，保持原 Volume 和变量。
4. 再次发送完全相同的预约请求，应返回原预约，且 `already_existed: true`。

## 常见问题

| 现象 | 先检查 |
| --- | --- |
| 构建找不到依赖文件 | Root Directory 是否为 `/backend`，requirements.txt 是否直接包含完整依赖列表且已推送 |
| 找不到 Python 模块 | 启动命令是否包含 `--app-dir src` |
| 502 或健康检查失败 | 启动日志、`0.0.0.0`、`$PORT` 和 `/health` |
| 重部署后预约丢失 | Volume 是否连接原服务，挂载路径是否与 `STATE_DIR` 一致 |
| curl 成功但前端请求失败 | 当前代码没有 CORS 配置；不同域名的浏览器前端需要补允许来源的配置，或使用同源代理 |

当前后端没有登录鉴权、支付或取消预约，适合先跑通 Hackathon 演示。

本文已核对当前源码与官方文档；尚未完成 Railpack 云端构建、发布或持久化验证。

参考：[Railpack Python](https://railpack.com/languages/python)、[Railway 启动命令](https://docs.railway.com/deployments/start-command)、[子目录部署](https://docs.railway.com/deployments/monorepo)、[持久化磁盘](https://docs.railway.com/volumes)。

构建排错依据：[Railpack 0.39.0 Python 源码 copyInstallFiles](https://github.com/railwayapp/railpack/blob/v0.39.0/core/providers/python/python.go#L401-L428)。
