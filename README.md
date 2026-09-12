<h1 align="center">MORE</h1>

<p align="center">
  <strong>More than once.</strong><br>
  A peer-to-peer platform for occasion wear with more life left to live.
</p>

<p align="center">
  <a href="#the-idea">The idea</a> ·
  <a href="#borrower-demo">Borrower demo</a> ·
  <a href="#run-locally">Run locally</a> ·
  <a href="#team">Team</a>
</p>

<p align="center">
  <em>Built at AI.WOMEN Hackathon, Hamburg, 12–13 September 2026.</em>
</p>

---

## The idea

We already have more than we think: more clothes in our wardrobes, more
occasions ahead, and more beautiful pieces that deserve another life. Yet when
we need something for an event, the default is still to buy something new.

MORE offers another way: **more to wear, give and share — more than once.** A
dress bought for one celebration can move to another woman, another city and
another unforgettable night. The goal is not to ask women to want less; it is to
create smarter ways to have more possibilities with less waste and less
consumption.

Occasion wear is a particularly good place to start. It is often bought for one
fixed date, worn once and left in a wardrobe. Renting extends the value of that
piece, while giving the next wearer something special without another purchase.

## Borrower demo

The current product focuses on the borrower flow. A borrower describes an event
in plain language, for example:

> I have a wedding in Sicily in September. I am looking for a chic mini dress
> with a trendy colour or print.

The assistant asks only for information that is still needed to run a reliable
availability check. When city, date or size are missing, it presents an
interactive card where the borrower can:

- choose a wear date;
- choose a city from the catalogue;
- select an EU size;
- optionally add an event type, such as a gala, wedding or party;
- send the selected details together with one click.

The assistant replies in English and returns **up to three** matching garment
previews. Each preview is checked for city, size, dates, shipping lead time,
existing bookings, return time and cleaning time before it is shown. A request
for a colour is treated as a filter, not merely a ranking preference.

The chat keeps its conversation state while the session is open. Starting a new
conversation creates a fresh backend conversation; it only appears in the
sidebar after its first message is sent.

### What the AI decides — and what it does not

| The model does | Deterministic backend code does |
| --- | --- |
| Extracts explicitly stated details from the borrower message | Checks size, city and date feasibility |
| Identifies missing information and writes a short question | Computes shipping, return and cleaning windows |
| Interprets an optional event or colour preference | Rejects garments with conflicting bookings or insufficient delivery time |
| Summarises the three recommendations in English | Returns the exact cards shown in the interface |

The availability result never comes from the model. It is computed from the
catalogue and the request, so a garment that cannot arrive in time is not
presented as a recommendation.

## Product boundaries

This is a hackathon prototype. It includes a real availability and reservation
flow, but does not include payment, user accounts, identity verification,
insurance, courier integration or booking cancellation. A reservation holds a
garment; it does not take payment.

The current frontend is borrower-first. Lender-facing routes and catalogue
building work remain in the repository, but they are not the active demo flow.

## Run locally

Requirements: Node.js 20+ and Python 3.12.

Start the FastAPI backend in one terminal:

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock.txt

# Required for live AI conversations
export OPENAI_API_KEY="..."
export OPENAI_MODEL="..."

PYTHONPATH=src .venv/bin/python -m borrowed_backend --demo-date 2026-09-16
```

The API and interactive documentation are then available at
`http://127.0.0.1:8000` and `http://127.0.0.1:8000/docs`.

Start the Next.js frontend in a second terminal:

```bash
cd frontend
cp .env.example .env.local
# For local backend development, set API_ORIGIN=http://127.0.0.1:8000 in .env.local
npm install
npm run dev
```

Open `http://localhost:3000/find`.

`API_ORIGIN` is server-side only. Next.js proxies `/api` and `/images`, so the
browser stays on one origin and does not need a public API variable. In Railway,
set `API_ORIGIN` to the deployed FastAPI URL. The frontend also has a production
fallback of `https://borrowed-production-58eb.up.railway.app`.

Useful frontend checks:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Architecture

```text
frontend/                         Next.js 15 + React 19
  app/find/                       borrower chat route
  components/chat/                chat stream, question cards, composer
  components/cards/               results and reservation UI
  lib/api.ts                      API origin and typed requests

backend/
  src/borrowed_backend/agents/    slot extraction and response composition
  src/borrowed_backend/domain/    dates, availability, ranking and models
  src/borrowed_backend/tools/     catalogue search and booking tools
  src/borrowed_backend/api/       FastAPI routes and SSE conversations
  data/catalog.json               386-item seed catalogue
```

The backend uses FastAPI, Pydantic, OpenAI Responses API and a single-process
in-memory store with JSON snapshots for reservations and conversation state.
The frontend connects to the conversation API over server-sent events (SSE).

## Data

The 386-item demo catalogue is based on public data from
[DCEY](https://www.davetcokelbisemyok.com). Images belong to DCEY and are used
for hackathon demonstration only. Rental prices, availability, delivery lead
times, bookings and lender details are demo-domain data modelled by the team.

See [DATA.md](DATA.md) for the source, pipeline and known gaps. The architecture
and full product specification are in [ARCHITECTURE.md](ARCHITECTURE.md),
[SPEC.md](SPEC.md), [frontend spec](specs/FRONTEND_SPEC.md) and
[backend spec](specs/BACKEND_SPEC.md).

## Built with

- Next.js 15 and React 19
- FastAPI and Pydantic
- OpenAI Responses API
- Server-Sent Events
- Railway

## Team

### Product

Gizem · Sonali · Neelamma

### Development

Vicky · Jing

## Licence

[MIT](LICENSE). The code is ours; catalogue images are not — see [Data](#data).
