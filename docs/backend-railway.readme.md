# Backend Deployment on Railway

English | [简体中文](backend-railway.readme-zh.md)

The backend uses FastAPI, LangGraph, and the OpenAI Responses API. It supports structured search, borrower text conversations, explicit booking confirmation, and recovery after restarts. **GitHub + Railpack** handles builds automatically; no Dockerfile or database setup is required.

This guide covers Railway configuration and cloud verification. For local setup, see [the backend README (Chinese)](../backend/README-zh.md). For the full conversation protocol, see [the protocol guide (Chinese)](../backend/docs/stage2-usage-zh.md).

For page startup and demos, see [the local demo guide (Chinese)](../backend/docs/stage3-usage-zh.md). Deploy the frontend using [the frontend Railway guide](frontend-railway.readme.md).

## 1. Push the code to GitHub

The Git repository is `borrowed`, with the backend in `backend`. `backend/requirements.txt` lists all pinned dependencies directly and has the same contents as `requirements.lock.txt`.

Railpack 0.39.0 does not automatically copy `requirements.lock.txt` during dependency installation, so `requirements.txt` cannot contain only `-r requirements.lock.txt`. After updating the lock file, sync it from the repository root:

```bash
cp backend/requirements.lock.txt backend/requirements.txt
```

Commit it along with the backend code, `data/catalog.json`, and `images/item-*.jpg` to the branch you plan to deploy.

## 2. Create a Railway service

Open [Railway](https://railway.com), select **New Project → Deploy from GitHub repo**, and choose your repository.

Configure the service:

| Setting | Value |
| --- | --- |
| Deployment branch | The branch containing your pushed backend code |
| Root Directory | `/backend` |
| Builder | `Railpack` |
| Build Command | Leave blank for automatic dependency installation |
| Healthcheck Path | `/health` |
| Replicas | `1`, in a single region |

Set **Start Command** to:

```bash
python -m uvicorn borrowed_backend.main:create_app --factory --app-dir src --host 0.0.0.0 --port $PORT --workers 1
```

Set this explicitly to override the fixed `8000` port in the existing Procfile. Do not add `--reload` or increase the worker count.

## 3. Add variables and a volume

Select the backend service and deployment environment. Add the following in **Variables**, individually or through **Raw Editor**. Replace the API key placeholder with your real key. Enter variable names and values without `export`:

```text
RAILPACK_PYTHON_VERSION=3.12
DEMO_DATE=2026-09-16
STATE_DIR=/state
OPENAI_API_KEY=replace-with-your-real-api-key
OPENAI_MODEL=replace-with-a-verified-model-id-available-to-your-account
LLM_TIMEOUT_S=25
DEBUG=false
```

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Credentials for backend requests to OpenAI; enter the real value only in Railway Variables |
| `OPENAI_MODEL` | Choose a model supporting the current Responses structured output interface and verify it locally first; there is no default in the code |
| `LLM_TIMEOUT_S` | Timeout per model call in seconds; defaults to 25, must be greater than 0 and no more than 120 |
| `DEBUG` | Defaults to false, disabling conversation state debugging endpoints |

Variable changes become staged deployment changes. Apply and deploy them before they affect the running service. [Railway variables](https://docs.railway.com/variables)

Running `export` in your local terminal does not sync variables to Railway. The application also does not automatically load `.env`. Never put real keys in code, README files, or Git. There is no default model name: missing either the key or model causes conversations to return `LLM_NOT_CONFIGURED`, even if startup and `/health` succeed.

Railway provides `PORT`; do not set it manually. The catalog and images use default paths in the source and require no additional configuration. `DEMO_DATE` fixes the demo date for the September 18 search below. Remove it when you want to use the real current date.

Create a **Volume** from the project canvas context menu, attach it to this backend service, and set **Mount Path to `/state`**.

Runtime data is stored in:

- `/state/bookings.json`: bookings and idempotent requests.
- `/state/conversations.json`: conversation slots and the recommendation data used to validate confirmations.

Setting `STATE_DIR` alone does not create a volume. You must mount a Volume to retain data across deployments. The current implementation requires a single instance and a single worker.

## 4. Deploy and generate a domain

1. Apply the settings and click **Deploy / Redeploy**. If the initial automatic deployment ran before configuration was complete, retry after finishing setup.
2. Check the logs for successful Uvicorn startup and a passing health check.
3. Under **Settings → Networking → Public Networking**, click **Generate Domain**.
4. If a target port is required, use the listening port shown in the startup logs; it must match `PORT`.
5. Open `/health` and `/docs` on the generated domain.

For example:

```text
https://your-domain.up.railway.app/health
https://your-domain.up.railway.app/docs
```

`/health` should return `status: ok` and `today: 2026-09-16`. It does not call OpenAI and cannot verify the key, quota, or model availability. Continue with the conversation checks below. A 404 at `/` is expected because the backend has no home page.

## 5. Verify structured search

Replace the domain and run in your local terminal:

```bash
export BORROWED_API_URL='https://your-domain.up.railway.app'
curl --fail-with-body -sS "$BORROWED_API_URL/health"
curl --fail-with-body -sS "$BORROWED_API_URL/api/garments/search" \
  -H 'Content-Type: application/json' \
  -d '{"city":"Hamburg","sizes_eu":[38],"wear_date":"2026-09-18","limit":1000}'
```

Search should return an array of garments. This endpoint does not call the model, so it helps distinguish backend deployment problems from model call problems.

## 6. Verify a real OpenAI conversation and SSE

Keep using `BORROWED_API_URL` from the previous step. Create a conversation:

```bash
curl --fail-with-body -sS "$BORROWED_API_URL/api/conversations" \
  -H 'Content-Type: application/json' -d '{"role":"borrower"}'
```

Set the variable to the returned conversation_id, then send a text message:

```bash
BORROWED_CONVERSATION_ID='conv-replace-with-returned-id'
curl --fail-with-body -N "$BORROWED_API_URL/api/conversations/$BORROWED_CONVERSATION_ID/turn" \
  -H 'Content-Type: application/json' -d '{"text":"I am attending a dinner party on Friday"}'
```

With the fixed demo date, the wear date should resolve to `2026-09-18`, and a `question` event should ask for the city and EU size. Continue with:

```bash
curl --fail-with-body -N "$BORROWED_API_URL/api/conversations/$BORROWED_CONVERSATION_ID/turn" \
  -H 'Content-Type: application/json' -d '{"text":"Hamburg, EU 38"}'
```

Expect `results` (available garments, actual dates, and `result_id`), `token` (explanation), and `done`. `curl -N` disables client output buffering. While waiting, the backend sends `: ping` after every 15 seconds without an event. HTTP 200 means the stream request has started, and `done` means the turn has ended. Check for `error` events as well; neither proves that a model call or booking succeeded.

Only text is supported. The turn endpoint rejects image uploads even if the selected model supports vision.

## 7. Confirm a booking and verify recovery across deployments

Choose a garment from the current conversation's results and put its ID and result_id into the JSON below. **This creates a real reservation in the demo data, with no payment or charge.** Plain text such as “book it for me” does not trigger a conversation booking; explicit confirmation fields are required.

```bash
curl --fail-with-body -N "$BORROWED_API_URL/api/conversations/$BORROWED_CONVERSATION_ID/turn" \
  -H 'Content-Type: application/json' \
  -d '{"intent":"book","garment_id":"item-replace-with-selected-id","confirmed":true,"result_id":"replace-with-id-from-these-results"}'
```

1. Save the conversation_id, complete confirmation JSON, and `booking_claim.booking` response. Only `booking_claim` indicates that the booking was saved successfully.
2. Search again for the same dates. The garment should no longer appear.
3. Redeploy the same service, keeping the original Volume, `STATE_DIR`, and `DEMO_DATE`.
4. Resend the original confirmation JSON directly using the same conversation_id. It should return the same booking_id with `already_existed:true`, and the garment should still be unavailable in search.

Do not send a new text message before testing recovery: every text turn invalidates the previous result_id. A confirmation request cannot also include text to change the criteria. To change the date, city, or size, first send text to obtain new results, then confirm. If two conversations compete for the same garment, the later confirmation receives availability and BOOKING_CONFLICT; it does not automatically book a different garment.

You can also verify structured bookings using `POST /api/bookings`. See [the backend README (Chinese)](../backend/README-zh.md) for the full request fields.

## Troubleshooting

| Symptom | What to check first |
| --- | --- |
| Build cannot find dependency files | Root Directory is `/backend`, and requirements.txt directly lists all dependencies and has been pushed |
| Python module not found | Start Command includes `--app-dir src` |
| 502 or failed health check | Startup logs, `0.0.0.0`, `$PORT`, and `/health` |
| Bookings or conversations disappear after redeployment | Volume remains attached to the original service, mounted at `/state`, and matches `STATE_DIR` |
| `LLM_NOT_CONFIGURED` | Both OPENAI variables are configured for the selected Railway service and environment, and the changes have been deployed |
| `LLM_TIMEOUT` | Model calls exceed LLM_TIMEOUT_S; inspect model and network conditions and adjust the timeout if needed |
| `TURN_FAILED` / `LLM_UNAVAILABLE` | Key validity, account quota, model permissions, and connectivity; the error code alone does not distinguish these causes |
| `CONFIRMATION_REQUIRED` | The garment belongs to the current conversation, result_id is current, and confirmed=true is explicit |
| `PERSISTENCE_FAILED` | Volume mount, write permissions, and capacity; if booking_claim was received, the booking succeeded and the original confirmation can be retried |
| HTTP 200 but the conversation fails | Inspect SSE error events; HTTP 200 and done do not mean business success |
| curl works but frontend requests fail | The backend has no CORS configuration; browser requests from a different domain require allowed origins or a same-origin proxy |

The backend has no login authentication, payment, or booking cancellation. It is suitable for a Hackathon demo.

References: [Railpack Python](https://railpack.com/languages/python), [Railway start commands](https://docs.railway.com/deployments/start-command), [monorepo deployment](https://docs.railway.com/deployments/monorepo), and [volumes](https://docs.railway.com/volumes).

Dependency build reference: [Railpack 0.39.0 Python source: copyInstallFiles](https://github.com/railwayapp/railpack/blob/v0.39.0/core/providers/python/python.go#L401-L428).
