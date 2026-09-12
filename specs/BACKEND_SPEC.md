# borrowed — Backend Implementation Spec

**Version 1.0 · 12 September 2026 · derived from `ARCHITECTURE.md` + `SPEC.md`**
**Audience: an AI coding agent. Every section is implementable without asking questions.**

---

## 0. Rules of engagement (read first, they are not negotiable)

1. **Vocabulary is `borrower` / `lender`. `renter`, `owner` and `user` never appear** in code, types, prompts, log lines or API fields. The only exception is reading `catalog.json`, which still has `owner_*` keys — those are renamed **in the loader only**.
2. **The availability engine is pure**: no I/O, no LLM, no `date.today()` inside it. `today` is always a parameter.
3. **Hard constraints are applied inside `search_garments`.** There is no `include_infeasible` flag, no way for any caller to bypass them.
4. **No tool returns prose.** Reasons are enums plus ISO dates. Sentence-writing belongs to the agent layer.
5. **Dates are `datetime.date` everywhere inside the process.** Strings only at the JSON boundary. Parse once, at load.
6. **One process, `uvicorn --workers 1`.** Pinned in the Dockerfile/Procfile and in the README.
7. Python 3.12, FastAPI, Pydantic v2, LangGraph, `anthropic` SDK, `fastmcp`. No database, no Redis, no Celery, no vector store.

---

## 1. Repository layout

```
backend/
  app/
    main.py                  # FastAPI app, lifespan: load store, mount /mcp
    config.py                # Settings (pydantic-settings)
    api/
      conversations.py       # POST /api/conversations, POST .../turn (SSE)
      garments.py            # GET /api/garments/{id}, /availability
      listings.py            # POST /api/listings/{id}/publish
      health.py
      sse.py                 # SSE event union + encoder
    domain/                  # LAYER 3 — pure, no imports from api/ agents/ data/
      dates.py               # the availability arithmetic
      availability.py        # feasibility(), explain()
      sizing.py              # EU size parsing + matching
      occasions.py           # free text -> the six values
      ranking.py             # deterministic pre-score (LLM re-rank is in agents/)
      models.py              # Garment, Booking, Feasibility, SearchRequest...
      enums.py               # Reason, Category, Occasion, Scope
    data/                    # LAYER 4 — repository interface + JSON impl
      loader.py              # catalog.json -> Garment models, derived fields
      store.py               # InMemoryStore: dicts + asyncio.Lock + snapshot
      repositories.py        # GarmentRepo, BookingRepo, ListingRepo, ConversationRepo
      snapshot.py            # atomic write: tmp + os.replace
    tools/                   # LAYER 2 — ONE registry
      registry.py            # @tool decorator, REGISTRY dict
      definitions.py         # all 9 tools
      adapters/
        langgraph_tools.py   # in-process bind
        mcp_server.py        # FastMCP app, external=True subset
    agents/                  # LAYER 1
      borrower_graph.py
      lender_graph.py
      prompts.py
      llm.py                 # thin Claude client: json_call(), text_stream()
      state.py               # BorrowerState, LenderState (JSON-serialisable)
    images/
      worker.py              # asyncio queue: segment -> crop -> exposure -> thumb
  data/
    catalog.json             # READ-ONLY SEED — never written to
    state/                   # runtime writes; delete to reset
      bookings.json
      listings.json
      conversations.json
  tests/
    test_dates.py  test_availability.py  test_sizing.py
    test_loader.py test_search.py test_booking_concurrency.py
    test_mcp_contract.py
```

---

## 2. Domain models (`domain/models.py`)

All Pydantic v2. `model_config = ConfigDict(frozen=True)` on everything except graph state.

```python
class Category(StrEnum):      DRESS="dress"; JEWELLERY="jewellery"; BAG="bag"
class Occasion(StrEnum):      GALA="gala"; PARTY="party"; FORMAL="formal"
                              ENGAGEMENT="engagement"; WEDDING="wedding"; WEEKEND="weekend"
class Reason(StrEnum):
    TOO_LATE_TO_SHIP="TOO_LATE_TO_SHIP"
    OUTSIDE_LENDER_WINDOW="OUTSIDE_LENDER_WINDOW"
    OVERLAPS_BOOKING="OVERLAPS_BOOKING"
    IN_CLEANING="IN_CLEANING"
    SIZE_MISMATCH="SIZE_MISMATCH"
    WRONG_CITY="WRONG_CITY"
```

### 2.1 `Garment`

| field | type | source |
|---|---|---|
| `id` | `str` | seed |
| `sku`, `name`, `name_raw`, `designer` | `str` | seed |
| `category` | `Category` | seed |
| `silhouette` | `str \| None` | seed (null on 41 — keep None) |
| `colour_family` | `str \| None` | seed (null on 88 — **None means unknown, never exclude**) |
| `occasion` | `list[Occasion]` | seed |
| `formality` | `int` | seed — **ranking only, never a filter** |
| `style_tags` | `list[str]` | seed (empty on 112) |
| `sizes_eu` | `list[int]` | seed (empty on the 136 accessories) |
| `rental_price` | `int` (EUR) | seed |
| `retail_price` | `int` | seed |
| `rental_days` | `int` | seed (4 on all) |
| `image` | `str` | seed |
| `lender_id` | `str` | **renamed from `owner_id`** |
| `lender_name` | `str` | **from `owner_name`** |
| `city` | `str` | **from `owner_city`** |
| `lender_rating` | `float` | **from `owner_rating`** |
| `bookings` | `list[Booking]` | expanded from `booked` — see §4.2 |
| `delivery_days`, `return_days`, `cleaning_days` | `int` | seed |
| `condition` | `str` | seed |
| `description` | `str` | seed |
| `is_sized` | `bool` | **derived**: `category == DRESS` |
| `available_from` | `date` | **derived**: load date |
| `available_to` | `date` | **derived**: load date + 120d |
| `thumb` | `str` | derived: `/images/thumbs/{id}.jpg`, falls back to `image` |
| `source_url`, `image_url` | `str` | kept but **never served to the frontend** (see §11) |

**Dropped at load and absent from the model:** `colour_raw`, `image_local`, `rental_price_try`.

### 2.2 `Booking`

```python
class Booking(BaseModel):
    id: str                 # "bk-<uuid4hex[:8]>"; seed blocks get "seed-<garment_id>-<n>"
    garment_id: str
    wear_from: date         # what the lender declared
    wear_to: date
    hold_from: date         # derived, see §4.2
    hold_to: date
    borrower_name: str | None = None
    created_at: datetime | None = None
    idempotency_key: str | None = None
    source: Literal["seed", "runtime"]
```

### 2.3 `Feasibility`

```python
class Feasibility(BaseModel):
    garment_id: str
    feasible: bool
    ship_by:    date | None   # None only when the garment does not exist
    lands_on:   date | None
    wear_from:  date
    wear_to:    date
    free_again: date | None
    reason: Reason | None = None       # set iff feasible is False
    blocking_booking_id: str | None    # set for OVERLAPS_BOOKING / IN_CLEANING
```

Serialise dates as `YYYY-MM-DD`. **Never** emit a human sentence from this model.

---

## 3. The availability engine (`domain/dates.py`, `domain/availability.py`)

Build this **first** and unit-test it before anything else exists.

```python
BUFFER_DAYS = 1     # baked in, never shown to the borrower

def compute_legs(wear_from, wear_to, delivery_days, return_days, cleaning_days) -> Legs:
    ship_by    = wear_from - timedelta(days=delivery_days + BUFFER_DAYS)
    lands_on   = ship_by + timedelta(days=delivery_days)      # == wear_from - 1
    back_by    = wear_to + timedelta(days=return_days)
    free_again = back_by + timedelta(days=cleaning_days)
    return Legs(ship_by, lands_on, back_by, free_again)
```

`wear_to` defaults to `wear_from + rental_days - 1` when the borrower gives only one date.

Across all HTTP APIs, tools and graph slots, `wear_date` means `wear_from` and
`return_date` means `wear_to`: the **last day of wear**, inclusive. It is not the
return-arrival date. Add `return_days` and `cleaning_days` after it using
`compute_legs()`; when omitted, use the default above.

### 3.1 `check(garment, req, today) -> Feasibility`

Evaluate in this exact order and **return on the first failure** (order defines which reason the borrower sees):

| # | test | reason on failure |
|---|---|---|
| 1 | `garment.city == req.city` (casefold) | `WRONG_CITY` |
| 2 | `garment.is_sized` and `set(req.sizes_eu) & set(garment.sizes_eu) == ∅` — **skip entirely when `is_sized` is False** | `SIZE_MISMATCH` |
| 3 | `today <= ship_by` | `TOO_LATE_TO_SHIP` |
| 4 | `available_from <= ship_by and free_again <= available_to` | `OUTSIDE_LENDER_WINDOW` |
| 5 | for each booking `b`: `not (free_again < b.hold_from or ship_by > b.hold_to)` | `IN_CLEANING` if the overlap lies **entirely** inside `(b.wear_to, b.hold_to]`, else `OVERLAPS_BOOKING`; set `blocking_booking_id` |

Interval overlap is **inclusive on both ends**. A hold ending on day *d* and another starting on day *d* **collide**.

### 3.2 `explain(garment, req, today) -> Explanation`

Same arithmetic, but **does not early-return**: returns every leg plus a list of
`{booking_id, hold_from, hold_to, clashes: bool}` for every booking considered.
This backs the `explain_availability` tool. Still no prose.

### 3.3 Required unit tests (`tests/test_availability.py`)

Golden case — delivery 1, rental 4, return 2, cleaning 1, wear Fri 2026-09-18:
`ship_by = 2026-09-16`, `lands_on = 2026-09-17`, `wear_to = 2026-09-21`,
`back_by = 2026-09-23`, `free_again = 2026-09-24`. **Nine days of hold for four of wear.**

Also test: `today == ship_by` is feasible; `today == ship_by + 1d` is `TOO_LATE_TO_SHIP`;
adjacent holds touching on one day collide; an unsized bag with `req.sizes_eu=[38]` passes test 2;
`delivery_days` 1/2/3 produce three different `ship_by` values for the same wear date.

---

## 4. Loader (`data/loader.py`)

### 4.1 Responsibilities

1. Read `data/catalog.json` once at lifespan startup.
2. Rename `owner_id/owner_name/owner_city/owner_rating` → `lender_id/lender_name/city/lender_rating`. **This is the only place the word `owner` exists.**
3. Drop `colour_raw`, `image_local`, `rental_price_try`.
4. Parse every date string into `date`.
5. Normalise `occasion` values onto the six-value enum; **drop unknown values with a warning log, never crash**.
6. Derive `is_sized`, `available_from`, `available_to`, `thumb`.
7. Expand `booked` → `Booking` (§4.2).
8. Merge `data/state/bookings.json` and `data/state/listings.json` over the seed.
9. Build the `lenders` index: `dict[lender_id, list[garment_id]]`.
10. Assert `len({g.id}) == len(garments)` — ids are unique; fail loud if not.

### 4.2 THE `booked` DECISION — implement exactly this

`booked` ranges are the **wear window** the lender declared. Expand on load:

```python
hold_from = wear_from - timedelta(days=g.delivery_days + BUFFER_DAYS)
hold_to   = wear_to   + timedelta(days=g.return_days + g.cleaning_days)
```

**Every runtime booking written by `create_booking` must use the identical
expansion** — call the same `compute_legs()` function, do not re-derive it.
This is the single most important consistency rule in the loader.

### 4.3 Demo date injection

`config.Settings.demo_date: date | None` from `--demo-date` / `DEMO_DATE` env.
`store.today()` returns `settings.demo_date or date.today()`. **Nothing else anywhere
calls `date.today()`.** Add a lint test that greps the codebase for `date.today()`
outside `store.py`.

---

## 5. Store and the write path (`data/store.py`)

```python
class InMemoryStore:
    garments: dict[str, Garment]
    bookings: dict[str, Booking]          # runtime + seed
    listings: dict[str, ListingDraft]
    conversations: dict[str, ConversationState]
    lenders: dict[str, list[str]]
    _lock: asyncio.Lock
```

### 5.1 The critical section — the only correct order

```
async with store._lock:
    garment = store.garments[garment_id]                     # fetch current copy inside lock
    feas = availability.check(garment, req, store.today())   # RE-CHECK inside the lock
    if not feas.feasible: raise Conflict(feas.reason)
    booking = commit(...)                                    # mutate memory
    snapshot("bookings")                                     # atomic tmp + os.replace
return booking
```

Both `create_booking` and `publish_listing` take the same lock. Never check
feasibility before acquiring it and trust the result.

`commit(...)` must update both `store.bookings[booking.id]` and the garment's
`bookings` before releasing the lock. Because `Garment` is frozen, replace it in
`store.garments` with `garment.model_copy(update={"bookings": [*garment.bookings,
booking]})`. On startup, rebuild each garment's booking list from the merged
`store.bookings`, matching `garment_id` and deduplicating by booking ID. Searches
must read the current garment from the store so a new hold is immediately visible.

### 5.2 Snapshot (`data/snapshot.py`)

```python
def write_atomic(path: Path, payload: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, default=str, ensure_ascii=False))
    os.replace(tmp, path)        # atomic on POSIX
```

Snapshot **on every commit**, not on shutdown. `catalog.json` is opened `"r"` and
never written — add a test that asserts its mtime is unchanged after a booking.

### 5.3 Idempotency

`create_booking(idempotency_key=...)`: if a booking with that key exists, return it
unchanged with `already_existed: true`. Keys live in memory and in the snapshot.

---

## 6. Tool registry (`tools/registry.py`, `tools/definitions.py`)

```python
@tool(name="check_availability",
      description="...",            # required, user-facing, no jargon
      input=CheckAvailabilityIn, output=Feasibility,
      scope="read",                 # "read" | "booking:write" | "write"
      internal=True, external=True)
async def check_availability(...): ...
```

`REGISTRY: dict[str, ToolDef]` is the single source of truth. Both adapters read it;
neither declares a tool of its own.

### 6.1 The nine tools

| tool | scope | internal | external | returns |
|---|---|---|---|---|
| `search_garments` | read | ✓ | ✓ | `list[SearchHit]` — **feasible only** |
| `check_availability` | read | ✓ | ✓ | `Feasibility` |
| `get_garment` | read | ✓ | ✓ | `Garment` (public projection) |
| `explain_availability` | read | ✓ | ✓ | `Explanation` |
| `suggest_bundle` | read | ✓ | ✓ | `list[SearchHit]` — same lender, same deadline |
| `create_booking` | `booking:write` | ✓ | scoped | `BookingResult` |
| `draft_listing_from_photo` | write | ✓ | ✗ | `ListingDraft` |
| `patch_listing` | write | ✓ | ✗ | `ListingDraft` |
| `publish_listing` | write | ✓ | ✗ | `{garment_id, ship_by_hint}` |

### 6.2 `search_garments`

```python
class SearchGarmentsIn(BaseModel):
    city: str
    wear_date: date
    return_date: date | None = None
    sizes_eu: list[int] = []
    category: Category = Category.DRESS
    occasion: Occasion | None = None
    colour_family: str | None = None
    style_hints: list[str] = []          # already-extracted tokens, never an image ref
    max_price: int | None = None
    limit: int = 20
```

Algorithm — in memory, no LLM:

1. Filter to `category`.
2. For each, run `availability.check()`. Keep `feasible == True` only.
3. Apply `max_price` if given.
4. Deterministic pre-score (`domain/ranking.py`), all soft:
   `+3` colour_family match (**None scores 0, never excludes**) ·
   `+2` occasion overlap · `+1` per style_tag hit (cap 3) ·
   `+1` `formality >= 4` · `+1` `lender_rating >= 4.5` ·
   `+1` `delivery_days == 1`.
5. Sort by score desc, then `rental_price` asc, then `id`. Truncate to `limit`.

Returns `SearchHit = {garment: GarmentPublic, feasibility: Feasibility, score: float}`.
**Never returns an infeasible garment. There is no flag to make it.**

### 6.3 `suggest_bundle`

`suggest_bundle(garment_id, wear_date, return_date?)` → accessories from the **same
`lender_id`**, in categories `jewellery`/`bag`, that pass `availability.check()` for
the same window. Because they are unsized, the size test is skipped (§3.1 rule 2).
Max 3 results, sorted by price asc.

### 6.4 `create_booking`

```python
class CreateBookingIn(BaseModel):
    garment_id: str
    wear_date: date
    return_date: date | None = None
    borrower_name: str | None = None
    idempotency_key: str
```

Description string — **this exact wording must reach the MCP client**:
> "Places a **real hold** on the garment for these dates. The garment immediately
> becomes unavailable to every other borrower. **No payment is taken and no card is
> charged** — this reserves the item only."

Returns `BookingResult = {booking_id, garment_id, ship_by, lands_on, wear_from,
wear_to, free_again, payment_taken: false, status: "reserved", already_existed: bool}`.
On conflict: HTTP 409 / MCP error with `{reason: Reason, feasibility: Feasibility}`.

### 6.5 `draft_listing_from_photo` / `patch_listing` / `publish_listing`

`ListingDraft` fields: `name, category, colour_family, silhouette, occasion[],
formality, style_tags[], sizes_eu[], rental_price, condition, description,
booked[], delivery_days, city` plus:

```python
provenance: dict[str, Literal["vision", "user"]]   # per field
size_unverified: bool                              # True while sizes_eu came from vision
```

`patch_listing` applies a JSON patch produced by the LLM through a **code merge**:
a field whose provenance is already `"user"` is never overwritten by a `"vision"`
value. **User value always wins — enforced in code, not in the prompt.**

`publish_listing` takes the lock, assigns `item-<uuid4hex[:8]>`, inserts into
`store.garments`, snapshots `listings.json`, enqueues image normalisation, and
returns `ship_by_hint` — the `ship_by` for the nearest declared wear window, so the
lender card can print `ship by Wed 16 Sep`.

**Hackathon publication defaults:** use one demo lender and fill the fields absent
from the draft in code, without another LLM call:

| field | value |
|---|---|
| `lender_id`, `lender_name`, `lender_rating` | `"lender-demo"`, `"Demo Lender"`, `0.0` (unrated) |
| `city`, `delivery_days` | draft value; if missing, `"Hamburg"`, `1` |
| `rental_days`, `return_days`, `cleaning_days` | `4`, `2`, `1` |
| `sku`, `name_raw`, `designer`, `retail_price` | generated garment ID, draft `name`, `"Unknown"`, `0` (unknown) |
| `image`, `thumb` | persisted original's local serving URL; use it for `thumb` until normalisation finishes |
| `source_url`, `image_url`, `image_credit` | `""`, `""`, `None` |
| `is_sized`, `available_from`, `available_to` | `category == DRESS`, `store.today()`, `store.today() + 120d` |
| `bookings` | expand draft `booked` with §4.2; empty list if omitted |

Persist the generated garment ID and complete published `Garment` alongside the
draft in `listings.json`, so the loader can restore it unchanged. Add its bookings
to `store.bookings` and its ID to the `lenders` index. If no wear window is declared,
return `ship_by_hint: null`.

---

## 7. Agent layer (`agents/`)

### 7.1 BorrowerGraph nodes

| node | kind | contract |
|---|---|---|
| `extract_slots` | LLM → JSON | reads the turn (+ optional image) → `{wear_date, return_date, sizes_eu, city, occasion, colour_family, style_hints, max_price}`; unknown fields are `null`, **never guessed** |
| `gate` | **CODE** | `if not (s.wear_date and s.sizes_eu): -> ask_missing` |
| `ask_missing` | LLM → text | asks for **at most 2** fields in **one** message, emits `question` SSE event, ends the turn |
| `search` | tool | `search_garments` |
| `explain_no_result` | tool+LLM | on 0 hits: `check_availability` on up to 5 near misses, emit `availability` events |
| `relax` | CODE | drop **one** axis and retry **once**. Order: `occasion` → `colour_family` → `style_hints` → `max_price`. **Never relax city. Never relax dates. Never relax size.** |
| `rank` | LLM | ONE call, ≤20 candidates in, ordered ids out |
| `compose` | LLM → tokens | writes sentences from `{reason, ship_by, lands_on, free_again}` only |
| `book` | tool | reachable **only** from an explicit user booking turn, gated in code |

The booking gate: a `book` edge requires `turn.intent == "book"` **and** a
`garment_id` the user named **and** a prior `results` event in the same
conversation. The model cannot reach `create_booking` on its own.

### 7.2 LenderGraph nodes

`persist_original` (immutable write) → `vision_extract` (ONE multimodal call, full
draft JSON) → `render_draft_card` → [user reply] → `parse_patch` (LLM → JSON patch)
→ `apply_patch` (CODE merge, §6.5) → `check` → `ask_one` or `ready` → `publish`.

### 7.3 State

`BorrowerState` / `LenderState` are Pydantic models, JSON-serialisable, persisted to
`store.conversations[conversation_id].slots` after every node. A debug route
`GET /api/debug/conversations/{id}` dumps it verbatim (enabled when `settings.debug`).

### 7.4 LLM rules

- Model id from `settings.anthropic_model`; never hardcoded in graph files.
- Every JSON-producing call uses a tool/structured-output schema, not free text.
- Every LLM call is wrapped with a timeout (`settings.llm_timeout_s`, default 25)
  and on failure emits an `error` SSE event with a recoverable message — the graph
  never crashes the stream.
- **No prompt anywhere asks the model to check dates or availability.**

---

## 8. HTTP API

```
POST   /api/conversations                      -> {conversation_id, role}
POST   /api/conversations/{id}/turn            -> text/event-stream
                                                  multipart/form-data: text + image?
GET    /api/garments/{id}                      -> GarmentPublic
GET    /api/garments/{id}/availability?wear=&return=  -> Feasibility
GET    /api/garments/{id}/explain?wear=&return=       -> Explanation
POST   /api/listings/{id}/publish              -> {garment_id, ship_by_hint}
GET    /api/lender/{lender_id}/garments        -> [GarmentPublic + next_hold?]
POST   /mcp                                     (FastMCP streamable HTTP)
GET    /health                                 -> {status, garments, bookings, today}
```

`POST /api/conversations` body: `{role: "borrower" | "lender"}`.

### 8.1 SSE event union

`event:` is the discriminator; `data:` is JSON. **Generate the TypeScript union
from these Pydantic models** — do not hand-write it twice.

| event | payload |
|---|---|
| `token` | `{text}` — streamed prose |
| `question` | `{text, fields: string[]}` — rendered distinctly by the UI |
| `listing_draft` | `{draft: ListingDraft}` |
| `results` | `{hits: SearchHit[], relaxed: string \| null}` |
| `availability` | `{feasibility: Feasibility, garment: GarmentPublic}` |
| `booking_claim` | `{booking: BookingResult}` |
| `error` | `{message, recoverable: bool}` |
| `done` | `{conversation_id}` |

Send an SSE comment heartbeat (`: ping`) every 15s so proxies do not close the stream.

### 8.2 The borrower's reference photo

`POST .../turn` accepts multipart with an optional image. For `role == "borrower"`
the bytes are read into memory, passed to the vision call, and **dropped**. They are
never written to disk, never logged, never put in conversation state. Only the
extracted `style_hints` tokens survive. Enforce this in the endpoint, and assert it
in a test that checks no file appeared under the image dir after a borrower turn.

---

## 9. MCP server (`tools/adapters/mcp_server.py`)

FastMCP app mounted at `/mcp`, streamable HTTP. Exposes exactly the `external=True`
tools from the registry, generated by iterating `REGISTRY` — no hand-written list.

Auth: `Authorization: Bearer <api_key>` → scope set. Default keys are `{"read"}`.
`create_booking` requires `"booking:write"`; without it the tool is **not listed**
and calling it returns an authorization error. Rate limit writes to 10/min/key.

**Contract test (`tests/test_mcp_contract.py`, required):** run every `external=True`
tool over the HTTP transport against the same fixtures the unit tests use, and assert
the responses are byte-equal to the in-process results. This is the only thing
covering the path our own agents never exercise.

---

## 10. Concurrency test (`tests/test_booking_concurrency.py`, required)

Fire 20 concurrent `create_booking` calls for the same garment and overlapping
windows via `asyncio.gather`. Assert: **exactly one succeeds**, the other 19 return
`OVERLAPS_BOOKING`, and `store.bookings` contains exactly one new record. This is
the two-window stage demo, automated.

---

## 11. Public projections and provenance

`GarmentPublic` is what leaves the process. It **omits `source_url` and `image_url`**
(scraped provenance, ARCHITECTURE §8.9) and serves `image`/`thumb` from the local
image store only. Add `image_credit: str | None` to the model now so the swap to
own photography is a data change, not a code change.

---

## 12. Definition of done

- [ ] `pytest` green, including `test_availability`, `test_mcp_contract`, `test_booking_concurrency`
- [ ] `GET /health` reports 386 garments loaded
- [ ] Hero query (`--demo-date 2026-09-16`, wear 2026-09-18, Hamburg, EU 38, dress) returns **24 feasible** with the refusal spread 72 / 19 / 69 / 66 (§ARCHITECTURE 8)
- [ ] No `date.today()` outside `store.py`; no `owner` outside `loader.py`; no `renter` anywhere
- [ ] `catalog.json` mtime unchanged after a full demo run
- [ ] Booking survives a process restart (snapshot-on-commit verified)
- [ ] `search_garments` has no parameter that can return an infeasible garment
