# Stage 2: borrower conversation API

Stage 2 uses **OpenAI Responses API**, as requested, with Pydantic structured extraction, streamed explanations, and LangGraph routing. Search and booking reuse the stage 1 registry and availability engine. Comments and docstrings are in English.

## Run

Install `requirements.lock.txt` in the Python 3.12 environment, then configure `OPENAI_API_KEY` and `OPENAI_MODEL` in the server environment. There is no hardcoded model default; choose an account-accessible model supporting Responses structured outputs. `.env` files are not loaded automatically. Optional `LLM_TIMEOUT_S` defaults to 25 seconds. Start the existing CLI with `--demo-date 2026-09-16`; retain exactly one instance and one worker.

The service starts without credentials; conversation turns return `LLM_NOT_CONFIGURED` until configured, while structured stage 1 endpoints remain available.

## Flow

1. `POST /api/conversations` with `{"role":"borrower"}` returns HTTP 201 and a `conversation_id`.
2. `POST /api/conversations/{id}/turn` with JSON `{"text":"I need a dress for a gala on Friday"}` returns SSE. Missing wear date, city or EU size produces a `question` asking for at most two fields.
3. Submit `{"text":"Hamburg, EU 38"}`. `results` contains feasible `hits`, `relaxed:null` and a `result_id`; `token` events explain actual results. Dates are resolved by code against the store clock, with no guessed city or size.
4. Choose a returned garment and submit `{"intent":"book","garment_id":"<selected ID>","confirmed":true,"result_id":"<returned result ID>"}`. This places a real hold without payment. The confirmed request must have no text; send preference changes as separate message turns.

Text such as “book this” never directly writes a booking. The API client must explicitly send the confirmation fields. The model cannot invoke booking. A garment must belong to that conversation's current results. Every message turn invalidates previous results, even if extraction subsequently fails. Confirmation retries reuse a stable key derived from conversation, result and garment; repeated requests and restarts cannot create a duplicate reservation.

Turns accept JSON or multipart/form-data with the same fields; multipart `text` is supported, images are not. Stream events are `question`, `results`, `token`, `availability`, `booking_claim`, `error`, and `done`, defined in Pydantic models in `api/sse.py`. A heartbeat comment is emitted after 15 seconds without an event. Treat only `booking_claim` as booking success. HTTP 200 and `done` alone do not imply success.

An empty results list includes an actionable prompt. Booking conflicts return actual `availability` plus a recoverable error. Model failures, timeouts, invalid extracted slots and persistence failures emit recoverable errors, followed by `done`. If chat persistence fails after a durable booking, the booking claim still reports success and the original confirmation can be retried. The booking write still checks feasibility inside the existing shared lock.

Conversation turns serialize per conversation. Slots and confirmation context are atomically saved to `data/state/conversations.json` after graph nodes. Full chat transcripts and API keys are not stored. Booking persistence remains separate in `bookings.json`. `DEBUG=true` enables `GET /api/debug/conversations/{id}`; it is hidden by default. Corrupt snapshots fail startup.

## Verify

```bash
.venv/bin/python -m pytest -q
.venv/bin/python scripts/smoke_stage1.py
.venv/bin/python scripts/smoke_stage2.py
```

Stage 2 smoke starts real HTTP servers and verifies SSE and process restart recovery with an explicitly injected scripted model. SDK tests use the actual OpenAI SDK with a mock HTTP transport. Neither proves live model quality or account access. Configure credentials and run the flow above for live acceptance. No UI, images, lender flows, MCP, model reranking or automatic relaxation are included.

References: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api).
