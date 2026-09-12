<h1 align="center">MORE</h1>

<p align="center">
  <strong>More to wear. More to give. More to share.</strong><br>
  A peer-to-peer rental platform that gives occasion wear more than one life.
</p>

<p align="center">
  <a href="#run-it">Run it</a> ·
  <a href="#what-the-model-decides--and-what-it-never-decides">How the AI is used</a> ·
  <a href="SPEC.md">Product spec</a> ·
  <a href="DATA.md">Data</a>
</p>

<p align="center">
  <em>Built at AI.WOMEN Hackathon, Hamburg, 12–13 September 2026.</em>
</p>

<!-- SCREENSHOT: save it as docs/screenshot.png and delete these two comment
     markers to switch the image on. Capture the compromise moment — the agent
     explaining why a dress cannot make Friday — not the results grid.

<p align="center"><img src="docs/screenshot.png" alt="MORE — the agent explaining why a dress cannot arrive in time" width="820"></p>

-->

---

## The problem

## MORE — to wear, give, share

We already have more than we think: more clothes in our wardrobes, more
occasions ahead, and more women with beautiful pieces they no longer wear.
MORE turns that hidden value into something that can move between women. A dress
bought for one wedding can have another woman, another city and another
celebration in its story.

Sustainability here is not asking women to want less. It is a smarter way to
have more: more possibilities with less waste, more style with less consumption,
and more life for what we already own.

**One evening, then three years in a wardrobe.** Occasion wear is bought for a
single fixed date — a gala, an awards dinner, a company anniversary — worn once,
and kept. Eight hundred euros for one evening, and the garment never comes out
again. Most wardrobes hold two or three of them, and the women who own them are
not going to wear them and will not sell them either.

Borrowing instead is better for everyone involved: for the woman who needs
something on Friday, for the woman whose gown has been in a garment bag since
2024, and for the pile of clothing neither of them wanted to own. It has not
replaced buying yet, and the reasons are practical rather than a matter of
taste.

**Saying what you want is work.** The real request is something like: a 38,
something dark, formal but not fussy, and in your hands by Thursday. Size is a
filter. Colour is a filter. "Not fussy" is not, and "by Thursday" — the part
that decides whether any of it matters — is not either. So the request gets
flattened into whatever dropdowns exist, and the rest of the judgement stays
with you, across sixty results and four open tabs.

**And whether it can actually reach you is unknowable.** Availability is not a
boolean: it is shipping time, the wear dates, the return leg, the cleaning
window, and every booking already sitting on that one garment. Unless somebody
computes all of it, a beautiful piece that cannot possibly arrive looks exactly
like one that can.

Rental is a deadline problem wearing the costume of a search problem.

## What it does

Two chat interfaces over one catalogue, one for each side of the marketplace.

**The borrower** describes an occasion in ordinary words — *"a gala in Hamburg
on Friday"* — or attaches a photo of a style she likes. The agent asks
for whatever it has not been told, then returns three garments that are in her
size, free on those dates, and deliverable before the event, each with the date
it would land and a sentence explaining the match.

**The lender** sends one photo. The model writes the listing — category, colour,
silhouette, occasion, formality, size, suggested rental price — and she corrects
it by replying in plain language: *"it's a 38"*, *"booked the 20th to the 25th"*.
Her garment is findable by borrowers immediately.

### Three claims, and they hold each other up

**1 · You say it once, in your own words.** Occasion, date, size, colour,
formality, and the things no dropdown has — *"quite formal but not fussy"*,
*"something like this"* with a photo attached. The agent takes the whole
sentence, and asks for what you left out instead of guessing at it.

**2 · What comes back is already the answer.** Three garments, not sixty. Every
one of them is in your size, free on your dates, and able to reach you before
the event, and each carries a line saying why it was chosen. There is nothing
left for you to filter, sort or cross-check, because the filtering was the easy
part and the machine did it.

**3 · It is a conversation, and that is the whole interface.** No account before
browsing, no filter panel, no wishlist, no four tabs. On the lender's side, no
listing form either — a photo and two replies. The friction that kills
peer-to-peer marketplaces is removed on both sides by the same mechanism.

These are not three features. **Claim 1 is only possible because a model reads
language, claim 2 is only trustworthy because plain code checks the dates, and
claim 3 is what you get when neither side has to translate itself into a form.**
Take any one away and the other two stop being worth much.

### The category, stated precisely

**Occasion wear for a dated event** — a gala, an awards dinner, a company
anniversary, a christening, a graduation ball, a formal party. Not everyday
clothing, which has no deadline and therefore nothing to reason about, and
**not bridalwear**, which is fitted in person over several appointments and is a
different service wearing similar words. The deadline is the entire product, so
the category is exactly the set of occasions where the date is fixed and the
piece is worn once.

**It is not only dresses.** The catalogue already carries bags, clutches and
jewellery alongside gowns, and the accessory case is where the reasoning gets
harder rather than easier: two items from the same lender have to travel
together and *both* have to clear the same deadline. Whole looks, coats, shoes
and menswear are catalogue work, not engine work.

**And the engine is not about clothing at all.** `is_available` knows about
shipping, a use window, a return leg, cleaning and existing bookings. Nothing in
it is specific to a garment — **anything that gets rented has availability
windows and return dates**, from photography equipment to ski gear to event
furniture. We built it for occasion wear because that is the domain we
understand and where the deadline genuinely bites, and the generalisation is a
property of the design rather than an ambition bolted onto it.

## What the model decides — and what it never decides

This is the part worth reading.

| The model does | Plain Python does |
|---|---|
| Turns a vague sentence into structured constraints — occasion, wear date, size, colour, formality | Decides whether a garment is actually free |
| **Notices what it has not been told and asks for it** — it will not search without a date and a size | Computes shipping, the rental period, the return leg and the cleaning window |
| Reads a reference photo into the catalogue's own vocabulary (long, dark, unembellished) | Checks the resulting window against every existing booking |
| Writes a listing from a photograph, and patches it from a casual reply | Ranks the survivors |
| Explains the result, and the compromise, **using only facts it was handed** | Produces those facts |

```python
def is_available(item, wear_date, size_eu, today):
    if size_eu not in item["sizes_eu"]:
        return False
    ship = wear_date - timedelta(days=item["delivery_days"])
    if ship < today:
        return False                       # cannot physically arrive
    frees = wear_date + timedelta(days=item["rental_days"]
                                  + item["return_days"]
                                  + item["cleaning_days"])
    return not any(overlaps(ship, frees, b) for b in item["booked"])
```

**The order matters and it is the product thesis:** hard constraints first,
similarity second. The intuitive order is the opposite — find the pretty things,
then worry about dates — and it produces a list that looks right and cannot
arrive. Because the model never decides availability, **it cannot promise a
piece that will not arrive**; and because it explains from facts it was handed
rather than generating them, the explanation is trustworthy rather than merely
fluent.

## Run it

```bash
npm install                 # image tooling for the catalogue build
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

| Route | |
|---|---|
| `/` | the borrower chat |
| `/owner` | the lender chat |

The frontend is built into `backend/static`, so one process serves the API and
the pages from a single origin — no CORS, no second terminal.

```bash
cd frontend && npm install && npm run build
```

Rebuilding the catalogue from scratch is documented in [DATA.md](DATA.md) and is
not needed to run the app — `backend/data/catalog.json` is committed.

## Architecture

```
frontend/                 Vite + React, two entry points, no router
  index.html   →  borrower chat     src/RenterApp.jsx
  owner.html   →  lender chat       src/OwnerApp.jsx
  src/Chat.jsx    one shared shell: messages, input, image upload, cards

backend/
  main.py          FastAPI · serves static/ · mounts /images
  agent_renter.py  Gemini: slots, ask-back, photo→attributes, explanations
  agent_owner.py   Gemini: photo→draft listing, reply→patch
  constraints.py   PURE PYTHON · dates, sizes, availability, reasons
  catalog.py       catalog.json in memory · normalise · filter · rank
  anymize.py       anonymises measurements before any model call
  data/catalog.json   images/   static/

tools/             catalogue build — scrape, enrich, localise images
```

No database. 386 items live in `catalog.json`, loaded into memory at startup and
filtered with a list comprehension. A hosted database would add a failure point
that depends on venue wifi and solve no problem this project has.

## Data

The catalogue is built from **[DCEY](https://www.davetcokelbisemyok.com)**, a
working Turkish rental service, through its public GraphQL endpoint — the site
is an Adobe Commerce PWA and its HTML is empty without JavaScript, so nothing is
scraped from markup. Full detail, including the extraction rules and the known
gaps, is in **[DATA.md](DATA.md)**.

| | |
|---|---|
| Items | **386** — 250 dresses, 41 bags and clutches, the rest jewellery |
| Taken from the source as-is | name, designer, sku, source URL, sizes, rental price, image, description, categories |
| Derived by rules | colour family, occasion, formality, style tags, silhouette, EU sizes |
| **Modelled by us** | rental and retail prices, owners, bookings, delivery / return / cleaning days, condition |

**Why the availability fields are modelled rather than scraped:** DCEY is a B2C
service and MORE is a peer-to-peer marketplace, so fields like "which
individual owns this and when is it already booked" do not exist in any source —
they are the domain model this product is built on. The modelling was written by
a supply-chain planner on the team, not estimated by an engineer. Every generated
value is deterministic from the item's `sku`, so the catalogue is reproducible
and identical for everyone.

> **Attribution.** The catalogue is based on public DCEY data. Images belong to
> DCEY and are used here for hackathon demonstration only. Rental and retail
> prices, availability, lead times and owners are modelled by the team.

## Built with

| | |
|---|---|
| **[Google Cloud — Vertex AI / Gemini](https://cloud.google.com)** | every model call: slot extraction, the ask-back loop, photo→attributes, listing auto-fill, explanations · **sponsor track** |
| **[Anymize AI](https://anymize.ai)** | anonymises measurements before they reach a model · **sponsor track** |
| **[Firecrawl](https://www.firecrawl.dev)** | catalogue collection |
| FastAPI · Vite · React · plain Python | the constraint engine is deliberately ours, not a library |

Tools we evaluated and chose against are listed in [SPEC.md](SPEC.md) with the
reasoning, so the absences are decisions rather than omissions.

## Team

Four people, four lanes.

| | Owned |
|---|---|
| **Vicky** | the constraint engine, the catalogue layer, both frontends |
| **Jing** | everything that talks to Gemini — both agents and the API wiring |
| **Gizem** | catalogue content and vocabulary, demo data, the pitch |
| **Sonali** | the availability model, the one-pager, the deck |

**The availability model was written by a supply-chain planner, not guessed by an
engineer, and the catalogue vocabulary was set by someone who spent eight years
in e-commerce merchandising at Inditex.** That is why the dates in this project
mean something. We lost our designer two days before the event, so the engineer
learned Vite during the build and shipped two interfaces instead of one.

## What we deliberately did not build

- **Payment, accounts, profiles, onboarding** — a booking that takes no money is
  a claim, not a transaction, and faking one would be the least honest thing in
  a project about honesty.
- **Embedding-based visual search** — reading a photo into attributes lets us say
  *why* something matched. A cosine distance cannot explain itself to a customer,
  and explaining is the product.
- **A database** — see above.
- **Identity verification, insurance, courier integration** — modelled in
  [SPEC.md](SPEC.md), not implemented. The timings they imply are the timings the
  engine computes with, which is the part that had to be real.

## Documents

- **[SPEC.md](SPEC.md)** — the product specification: what it is, who it is for,
  the two user scenarios, and the operations behind the dates.
- **[DATA.md](DATA.md)** — the catalogue: source, pipeline, what is real, what is
  modelled, and the two things to know before writing a filter.

## Licence

[MIT](LICENSE). The code is ours; the catalogue images are not — see Attribution.
