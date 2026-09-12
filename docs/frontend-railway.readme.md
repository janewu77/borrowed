# Frontend Deployment on Railway

English | [简体中文](frontend-railway.readme-zh.md)

The frontend uses Next.js 15 and React 19, deployed through **GitHub + Railpack**. No Dockerfile is required. Create a separate Railway service for the frontend so it builds and runs independently from the backend.

See [the documentation index (Chinese)](README.md) and [the local demo guide (Chinese)](../backend/docs/stage3-usage-zh.md).

## 0. Deployment prerequisites and feature scope

The deployment branch must include the API, date, reason, and SSE implementations under `frontend/lib/`, along with `api-types.ts` and the generated `openapi.generated.ts`. Confirm these files are committed and pushed before deploying.

`npm run gen:types` generates `lib/openapi.generated.ts` from the Pydantic HTTP/SSE models exported by `backend/scripts/export_contract.py`; `api-types.ts` references these types. Generation requires a local backend Python environment, but not a running backend service. Railway builds `/frontend` using the committed generated file and does not run generation across directories during the build.

| Feature | Current behavior | Usage notes |
| --- | --- | --- |
| Borrower text conversations at `/find` | Sends JSON text turns and displays SSE questions, recommendations, replies, and errors | Configure the OpenAI key and model on the backend and verify cloud conversations |
| Booking confirmation | Reserve opens a dialog; Confirm reservation submits intent=book, garment_id, confirmed=true, and result_id without nonempty text | Only booking_claim indicates success; booked garments are unavailable during their reserved dates |
| Recommendation invalidation and retries | New text disables old recommendations; failed confirmations can retain the original request for retry; missing done is reported as an interrupted stream | The backend handles idempotency; search again after conflicts, with no automatic alternative booking |
| Image upload | The borrower upload entry point is disabled, and the backend rejects file uploads | Not implemented |
| Lender conversations at `/list` | Shows a not-yet-available notice and does not create a lender conversation | Not implemented |
| Publishing listings and lender inventory | No corresponding backend routes; some frontend components and inventory page code remain | Do not demonstrate these as working features |

Refreshing creates a new conversation and does not restore the full chat history. Booking data is stored in backend JSON snapshots.

## 1. Verify the local build

Run with Node.js 22:

```bash
cd /Users/jingwu/hackathon-202609/borrowed/frontend
npm ci
npm run typecheck
npm run build
```

Commit and push the frontend source, `package.json`, `package-lock.json`, `next.config.ts`, and TypeScript configuration to the deployment branch. Do not commit `node_modules` or `.next`.

The repository's `env.local` is missing the leading dot, so Next.js does not automatically load it as a standard `.env.local` file. Use Railway Variables for cloud configuration; local environment files do not configure the cloud service. [Next.js environment variables](https://nextjs.org/docs/pages/guides/environment-variables)

## 2. Create a frontend service

In the existing Railway project, select **New → GitHub Repo**, choose the same `borrowed` repository, and add a service, for example `borrowed-frontend`.

Configure the frontend service in Settings:

| Setting | Value |
| --- | --- |
| Deployment branch | The branch containing the complete pushed frontend code |
| Root Directory | `/frontend` |
| Builder | `Railpack` |
| Build Command | `npm run build` |
| Start Command | `npm run start -- --hostname 0.0.0.0 --port $PORT` |
| Healthcheck Path | `/` |
| Replicas | Start with `1` |

Keep the backend service's Root Directory at `/backend`; do not change it to `/frontend`.

Railpack should see `package.json` and `package-lock.json` directly. If its analysis still shows repository directories such as `backend/` and `frontend/`, the frontend Root Directory has not taken effect. The cloud `/app` directory is created by the build tool and contains the selected `frontend` directory's contents. [Railway monorepo deployment](https://docs.railway.com/deployments/monorepo)

This project proxies API requests through the Next.js server and uses `next build` + `next start`. It does not need static export, and you should not run `npm run dev` in production. [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/next)

## 3. Add environment variables

Set these in the frontend service's **Variables**:

```text
RAILPACK_NODE_VERSION=22
RAILPACK_NODE_NPM_INSTALL=npm ci
API_ORIGIN=https://your-backend-domain.up.railway.app
```

Set `API_ORIGIN` to the backend's HTTPS root address, without `/api`. Do not use the frontend's own domain or `localhost`. Railway injects `PORT`; do not set it manually. [Railpack Node.js](https://railpack.com/languages/node)

`next.config.ts` reads `API_ORIGIN` and proxies:

```text
Browser → frontend-domain/api/...    → API_ORIGIN/api/...
Browser → frontend-domain/images/... → API_ORIGIN/images/...
```

The default backend address, `http://127.0.0.1:8000`, is for local development only. Set `API_ORIGIN` explicitly on Railway, or requests will target port 8000 inside the frontend container itself. Configure it before the first build. After changing `API_ORIGIN`, rebuild and redeploy to update the rewrites in the build output. [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)

Address selection in `lib/api.ts` works as follows:

- Browser code reads `NEXT_PUBLIC_API_BASE`. When unset, it uses an empty prefix for same-origin `/api/...` and `/images/...` requests.
- Server-rendered pages read `API_ORIGIN`, defaulting to `http://127.0.0.1:8000`. Garment details and lender pages use this logic.
- `next.config.ts` uses `API_ORIGIN` for the same-origin proxy, with the same default backend address as the server-side API code.

**When following this guide, leave `NEXT_PUBLIC_API_BASE` unset and remove any existing nonempty value.** Browser requests then pass through the Next.js same-origin proxy, generally avoiding additional browser-to-backend CORS configuration. Setting it to the backend domain bypasses the proxy and requires separate CORS handling; the backend currently has no CORS middleware. Changes to this public variable also require a rebuild because Next.js embeds it in browser code at build time. [Next.js environment variables](https://nextjs.org/docs/pages/guides/environment-variables)

The code does not read `NEXT_PUBLIC_API_URL`; setting it does not change the API address.

The frontend needs no Volume or database. The backend handles booking persistence. Keep model API keys and other backend secrets on the backend service, never in browser-visible `NEXT_PUBLIC_*` variables.

## 4. Deploy and generate a frontend domain

1. Apply the configuration and click **Deploy / Redeploy**.
2. Confirm dependency installation and `next build` succeed, and the runtime logs show the service is ready.
3. Under **Settings → Networking → Public Networking**, click **Generate Domain**.
4. If a target port is required, use the listening port in the logs that matches `$PORT`.
5. Open the frontend domain. It should display “More to wear. More to give. More to share.” and two entry points.

Use `/` for the frontend health check. The frontend has no `/health` endpoint and does not include the backend's `/health` in its rewrites. Check backend health directly on the backend domain. [Railway Next.js guide](https://docs.railway.com/guides/nextjs)

## 5. Verify pages and the backend proxy

Replace both domains and run in your terminal:

```bash
export BORROWED_FRONTEND_URL='https://your-frontend-domain.up.railway.app'
export BORROWED_BACKEND_URL='https://your-backend-domain.up.railway.app'

curl --fail-with-body -sS "$BORROWED_BACKEND_URL/health"
curl --fail-with-body -I "$BORROWED_FRONTEND_URL/"
curl --fail-with-body -sS "$BORROWED_FRONTEND_URL/api/garments/search" \
  -H 'Content-Type: application/json' \
  -d '{"city":"Hamburg","sizes_eu":[38],"wear_date":"2026-09-18","limit":1000}'
```

This search example uses the backend demo configuration `DEMO_DATE=2026-09-16`. Adjust the wear date when using real dates. The search targets the frontend domain to verify that the proxy reaches the backend.

Then check in a browser:

- Both home page entry points, `/find` and `/list`, open. `/list` currently shows a not-yet-available notice; do not demonstrate a lender flow.
- `/images/...` images returned by search load through the frontend domain.
- `/find` creates a conversation and displays streamed replies after text input. Requests in the browser Network panel have no 4xx/5xx errors. HTTP 200 alone is insufficient; also check for SSE `error` events.
- A garment detail page at `/garment/actual-garment-id` renders, verifying the server-side API request path.

The backend requires `OPENAI_API_KEY` and `OPENAI_MODEL` to verify real model conversations. Without them, an HTTP 200 SSE response may still contain `LLM_NOT_CONFIGURED`. Continue with the demo data:

1. In two tabs, enter “I am attending a dinner party on Friday”, then “Hamburg, EU 38”. Obtain a recommendation for the same garment in both tabs before proceeding.
2. Open Reserve in each tab, then click Confirm reservation in sequence. The first should receive booking_claim; the second should display BOOKING_CONFLICT.
3. Refresh and search again. The booked garment should no longer appear. Redeploy the backend with the same Volume and verify it remains unavailable.

These confirmations write backend data without charging money. A working page, health check, or single text reply does not replace these checks. The credential-free scripted demo is only for local reproduction; see its input restrictions in [the local demo guide (Chinese)](../backend/docs/stage3-usage-zh.md).

## Troubleshooting

| Error or symptom | Check and resolution |
| --- | --- |
| Railpack cannot determine how to build | Set Root Directory to `/frontend` and ensure the deployment branch includes `package.json` |
| `Module not found: ...lib/api` or similar | Ensure the deployment branch includes the implementations under `frontend/lib` and `openapi.generated.ts` |
| `npm ci` reports a lock mismatch | Sync package.json and package-lock.json locally, verify the build, and commit both |
| TypeScript or build tools are missing | Do not configure dependency installation to omit devDependencies; the build requires them |
| Startup cannot find a production build | Build Command must run `npm run build`, not just install dependencies |
| Page returns 502 | Check that Start Command uses `0.0.0.0` and `$PORT`, and inspect runtime logs |
| Frontend `/health` returns 404 | Use `/` for frontend health checks; `/health` belongs to the backend |
| Home page works but API returns 502 | Check API_ORIGIN and backend health; rebuild after changing variables |
| API returns 404 | Verify that the deployed backend version has the endpoint; API_ORIGIN must not include `/api` |
| Garment detail request fails | Check runtime API_ORIGIN, backend status, and garment ID |
| Browser reports a CORS error | Remove any nonempty NEXT_PUBLIC_API_BASE and rebuild to restore the same-origin proxy |
| `/list` says it is not yet available | Expected behavior; only the borrower flow is implemented |
| Booking confirmation returns 422 | Check the deployed version and ensure the actual JSON includes intent=book, garment_id, confirmed=true, and result_id, without nonempty text |
| BOOKING_CONFLICT | Another conversation has reserved the garment; search again or change dates |
| An image attachment entry point still appears | Check for an old frontend deployment; the borrower upload entry point is disabled |
| Conversation returns HTTP 200 but shows a model configuration error | Inspect the SSE error and backend OPENAI_API_KEY / OPENAI_MODEL |
| Streamed replies do not appear | Inspect the browser stream request, frontend proxy, and backend logs separately; a healthy home page does not verify SSE |
