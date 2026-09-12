# borrowed — Product Specification

**Version 0.2 · updated 12 September 2026**

A peer-to-peer rental service for occasion wear.

---

## 1. The product

> **In one sentence:** borrowed is a peer-to-peer rental service for occasion
> wear where both sides talk to an agent instead of filling in forms, and where
> nothing is ever offered that cannot physically arrive in time.

### 1.1 What it does

A borrower describes an occasion in ordinary words — *"a wedding in Hamburg on
Friday"* — and gets back three garments she can actually take: in her size, free
on those dates, and deliverable before the event. She can attach a photo instead
of describing a style. The assistant asks for anything it needs and has not been
told, and it never searches on a guess.

A lender lists a garment by sending a photo. The model writes the listing —
category, colour, silhouette, occasion, formality, suggested size and rental
price — and she corrects it by replying in plain language: *"it's a 38"*,
*"booked the 20th to the 25th"*. Her piece becomes available to borrowers
immediately.

Between the two sits the part that is not conversational at all. Availability is
arithmetic — shipping time, the wear dates, the return leg, the cleaning window,
and every booking already on that garment — and it is computed deterministically
in code. The model reads intent and explains results; it never decides whether
something is free. **That separation is why the assistant cannot promise a dress
that will not arrive**, and it is the product's central claim.

### 1.2 The behaviour that defines it

- **It asks before it searches.** Without a date and a size, an answer would be
  a guess dressed up as a recommendation.
- **It offers only what can arrive.** Hard constraints are applied first, and
  style similarity ranks what survives. Most competitors do this in the opposite
  order and show beautiful garments that cannot make Friday.
- **It explains a compromise rather than hiding one.** When the closest match
  cannot make the date, it says so and says why, then offers what can.
- **It reasons about combinations.** A dress and a clutch from the same lender
  travel together — one delivery, and both have to arrive.

### 1.3 What it deliberately is not

| Not | Why |
|---|---|
| **A shop** | Garments belong to individual people, not to an inventory we own. That is what makes availability genuinely unpredictable, and therefore worth computing. |
| **Everyday rental** | A subscription wardrobe has no deadline, and without a deadline the entire premise collapses. Occasion wear is the only category where the date is real. |
| **A recommender** | The point is not taste. The point is truth about whether a specific garment can be worn on a specific day. |
| **A search interface with a chat skin** | If the conversation could be replaced by five dropdowns without loss, it would be the wrong product. |

---

## 2. Customers

### 2.1 Two types, and what we call them

There are exactly two kinds of customer, on opposite sides of the same
transaction. Both are customers — neither is "the platform's supply".

| | **Lender** | **Borrower** |
|---|---|---|
| Wants to | rent out a garment she owns | borrow a garment for one occasion |
| Brings | supply, and the availability constraints on it | the deadline, the size and the occasion |
| Chat | the lender chat — photo in, listing out | the borrower chat — occasion in, three options out |
| Earns / pays | receives the rental fee, minus the platform cut | pays the rental fee, all-inclusive |

> **A note on the word "renter".** In English it can mean either side, which is
> exactly the confusion this table exists to remove. This document uses
> **lender** and **borrower** throughout and avoids "renter" entirely. The two
> actions are *lend / rent out* and *borrow / rent*.

They are not equally weighted. **The borrower with a dated event is who the
product is designed around**; the lender exists so that supply is real.

### 2.2 The borrower — primary

**A guest with a dated event and not enough time.** She has been invited to a
wedding, a gala, a company anniversary or a christening. She does not want to
buy a garment she will wear once, and she has left the decision later than she
meant to.

| | |
|---|---|
| Age | 25–40 |
| Where | Hamburg and surrounds |
| Timing | event 3–14 days away |
| Size | EU 34–44 |
| Spend | €80–250 — roughly 10% of retail |
| Occasions | wedding guest, gala, formal, cocktail |
| Period | up to 5 days, extendable on request |

### 2.3 The lender — supply side

**A woman with occasion pieces she has worn once.** Two or three good garments
hanging in a wardrobe, bought for a specific event and unworn since. She is not
running a business and will not maintain an inventory system.

| | |
|---|---|
| Age | 28–45 |
| Where | Hamburg — same city as borrowers |
| Wardrobe | 1–5 listable pieces |
| Effort | under 2 min per listing, or she stops |
| Motive | the garment earns rather than hangs |
| Frequency | lists once, lends occasionally |

### 2.4 What is true of both

These four apply to lenders and borrowers alike, and together they define who is
allowed on the platform at all.

**Verified identity.** Both sides complete identity verification before their
first transaction — document check plus a matching payment method. The
specification assumes every customer in it is verified; nothing downstream works
otherwise. **This is the precondition for the cover in §4.4**: an insurer cannot
underwrite an anonymous stranger, and a woman will not lend a €900 gown to one
either. Verification is the quiet feature that makes the loud ones possible.

**Women only.** Both sides of the first version are women. This is a product
decision, not only a catalogue one: much of the reason a lender is willing to
hand a garment to a stranger is who that stranger is. It is stated openly at
signup and enforced at verification. Opening to all genders is a deliberate
later step (§5).

**Hamburg.** One city for the first version. Delivery times are only trustworthy
inside a region we can model, and a promise about Friday is the only thing this
product actually sells. Both sides are in the same city, which is also what keeps
delivery to one or two days.

**English and German.** The assistant works in both, and switches to whichever
the customer writes in. This is not localisation of an interface — it is the
conversation itself: *"Hochzeit am Freitag"* has to resolve to the same wear date
as *"wedding on Friday"*, and a listing written from a German reply must produce
the same structured fields. The catalogue's internal vocabulary stays in one
language so the filter does not fork; only what the customer reads and writes is
bilingual.

### 2.5 The sharpest version of the focus

If the audience has to be one sentence: **a woman in Hamburg who has a dated
event within two weeks, needs one outfit for it, and would rather be told the
truth about delivery than shown a beautiful dress that will not arrive.** Every
feature is judged against her.

### 2.6 Who we deliberately do not serve yet

- **Brides** — fittings, alterations, multiple appointments and far higher
  emotional stakes. A different product wearing the same words.
- **Same-day and next-day** — if nothing can ship in time, the honest answer is
  no, and a service whose main answer is no is not a service. Three days is the
  floor.
- **Everyday and workwear** — no deadline, so no constraint to reason about, so
  no reason for us to exist.
- **Sizes outside EU 34–44** — not a decision about who should be served; the
  available catalogue does not carry enough beyond that range to give an honest
  answer. Naming the limit is better than failing quietly inside it.
- **Men, as customers and as a catalogue** — out of scope for the first version,
  on both sides. See §5.
- **Unverified customers** — no browsing-then-deciding. Verification precedes the
  first transaction for everyone.

---

## 3. User scenarios

One scenario per side of the marketplace. Each is written as it should behave in
the product, not as it behaves in the demo — where the two differ, the
difference is noted.

### 3.1 Scenario A — the lender lists a garment

**Lena, 34 — Hamburg, Eimsbüttel. Verified.** Wore an emerald floor-length gown
to one gala eighteen months ago. It cost €890 and has hung in a garment bag
since. She has thought about selling it and never got round to photographing it
properly.

**Trigger.** A friend mentions she borrowed a dress for a wedding instead of
buying one. Lena opens borrowed on her phone that evening, with about two
minutes of attention and no intention of filling in a form.

| # | Lena does | The system does |
|---|---|---|
| 1 | Opens the lender chat and sends one photo of the gown on a hanger. | Accepts the image. **Saves it locally** at listing resolution — the listing needs a picture that still exists tomorrow. |
| 2 | Waits a few seconds. | **The model reads the photo and writes the listing:** category, colour family, silhouette, occasion tags, formality, style tags, an estimated size and a suggested rental price. It renders as a draft card in the conversation, not as a form. |
| 3 | Reads the card. The size is wrong and it does not know her calendar. She types in German: *"das ist eine 38, und vom 20. bis 25. ist es vergeben"*. | Parses the reply into a patch on the draft — `sizes_eu: [38]` and a booking range — and confirms in words, in German, what it changed. Nothing else on the card is disturbed. |
| 4 | Corrects the price: *"90 pro Verleih"*. | Updates the price. If a field it needs is still empty it asks for that one field, and only that one. |
| 5 | Taps publish. | Adds the garment to the live catalogue with her name, city, rating and verified status attached. **It is findable by borrowers immediately** — no review queue, no approval step. |

**Outcome.** A complete, constraint-bearing listing exists in under two minutes,
and Lena never saw an input field. The dress is bookable by a stranger — a
verified one — before she puts her phone down.

**What this proves.** The model does work that a form cannot: it turns a
photograph and two casual sentences, in either language, into structured data the
availability engine can compute with. Supply-side friction is the reason
peer-to-peer marketplaces die, and this is where it gets removed.

> **Scope note.** In the weekend build, the minimum version of this scenario is
> steps 1, 2, 3 and 5 — photo, auto-filled draft, one correction, publish. Step
> 4 and the system asking back for missing fields are the next increment, not
> the baseline. Verification is assumed, not implemented.

### 3.2 Scenario B — the borrower finds something that can arrive

**Mira, 29 — Hamburg, Altona. Verified.** A colleague's wedding on Friday. It is
Wednesday evening. She has spent forty minutes across three rental sites, has a
tab open on a dress she likes, and cannot work out whether it would reach her in
time — none of the sites will say.

**Trigger.** Two days out, no outfit, and the actual blocker is not choice — it
is that nobody will tell her the truth about delivery before she pays.

| # | Mira does | The system does |
|---|---|---|
| 1 | Types: *"I have a wedding in Hamburg on Friday."* | Extracts what it can — occasion `wedding`, city, a wear date resolved from "Friday" against today. Notes what is missing: size, and how formal. |
| 2 | Expects results. Gets a question instead. | **Does not search.** Asks for her size and whether it is indoors or outdoors, in one message. Without a date and a size, any list it produced would be a guess. |
| 3 | Answers: *"38, indoors, quite formal."* Then attaches a screenshot of a dress she saw: *"something like this."* | Reads the photo into the catalogue's own vocabulary — long, dark, unembellished, formality 4 — and says out loud what it saw. **The photo is used and discarded, never stored.** |
| 4 | Waits. | Applies the hard constraints **first**: size 38, free across shipping, the rental period, return and cleaning, and reachable before Friday. Ranks only the survivors by similarity to what it read from the photo. |
| 5 | Sees three dresses, each with the date it would land and a line explaining the match. | Renders the three, with lender, price, and a delivery date computed rather than promised. One of them was listed by Lena an hour earlier. |
| 6 | Notices the closest match to her screenshot is missing, and asks. | **Explains the compromise from facts, not from invention:** that dress is free, but in her size it cannot reach Hamburg before Saturday. Names the nearest alternative in shape and why it works. |
| 7 | Chooses one and asks about accessories. | Offers a clutch belonging to the same lender, so the two ship together, and confirms both clear the Friday deadline as one delivery. |
| 8 | Asks whether she can keep it over the weekend. | Checks the next booking on that garment. The standard period is 5 days; an extension is possible only if nothing is booked behind it, and it carries a fee — so the answer is a real yes or a real no, not a policy sentence. |
| 9 | Books it. | Writes the booking range onto the garment. It disappears from other borrowers' results for those dates **within the same second** — the constraint it just created is now enforced against everyone else. |

**Outcome.** Mira has an outfit that will arrive on Thursday, for about a tenth
of what the dress costs to buy, chosen in one conversation instead of across
three tabs. Nothing she was shown could have failed to arrive.

**What this proves.** Two things a search interface cannot do: noticing what it
has not been told and asking for it, and explaining a trade-off it did not
invent. Both sit on arithmetic done in code, which is what makes the explanation
trustworthy rather than fluent. Step 8 is the same arithmetic answering a
question no catalogue could.

> **Scope note.** Steps 1, 2, 4, 5 and 6 are the core and are never cut. The
> photo in step 3 and the accessory in step 7 are the next increment. Steps 8
> and 9 — extension and booking — are described for completeness but are **not
> built for the weekend**: there is no payment, and a booking that takes no money
> is a claim rather than a transaction.

---

## 4. Operations — what runs under the hood

For the product team. The conversation is the visible half; this is the half
that makes its promises true.

> **The connection.** Every operational choice here becomes a field on a
> garment. `delivery_days`, `rental_days`, `cleaning_days`, `return_days` and
> `condition` are not estimates we invented — they are what logistics, cleaning
> and inspection actually take. Change an operation and the dates the agent
> quotes change with it.

### 4.1 The rental period — up to five days

The standard period is **up to 5 days**, counted from delivery to collection. It
is a product decision before it is a logistics one: five days covers travelling
to a wedding on Friday and returning on Monday, which is the shape of almost
every occasion this product serves.

| Rule | Consequence |
|---|---|
| **Maximum 5 days as standard.** The borrower chooses anything from 1 to 5; the agent proposes the shortest window that covers her event. | `rental_days ≤ 5`. A shorter period frees the garment sooner and makes it available to more people, so the agent does not pad it "just in case". |
| **Extension on request, for an additional fee.** Granted only if no booking sits behind it once shipping, return and cleaning are accounted for. | Not a policy the agent recites — a calculation it performs. The answer is a real date or a real no. |
| **An extension is never granted retroactively.** A late return is a late return, and it is charged as one. | Protects the next borrower's deadline, which is the whole product. |
| **The period is part of the availability window, not separate from it.** | `[ship_by, wear_start … wear_start + rental_days + return_days + cleaning_days]` must be clear of every existing booking. |

### 4.2 Delivery — the two legs

A rental is two journeys, not one. Out: lender to borrower, before the wear date.
Back: borrower to cleaner to lender. Only the first is visible to the borrower,
but the second is what determines when the garment is free again.

| Decision | What it produces |
|---|---|
| **Tracked courier, regional, 1–2 working days.** Not same-day, not standard post. Prepaid return label goes in the box on the way out, so the borrower never has to arrange anything. | `delivery_days` per garment, set from the lender's district. `return_days` for the journey back. |
| **One day of buffer is baked in and never shown.** The agent quotes the conservative date. Arriving a day early is a pleasant surprise; arriving on the morning of is a catastrophe. | The `ship_by` the agent quotes is `wear_date − delivery_days`, already conservative. |
| **The lender is told her ship-by date, not asked for one.** A reminder fires on that date. This is the single operational failure that destroys the product, because the whole promise is about a date. | Feeds the handover chain — the workflow that notifies the lender on the date the engine calculated. |
| **If the courier is late anyway:** the borrower is told before she would otherwise find out, and the rental is refunded in full without a claim. A late dress is worthless, not partly worth it. | Nothing in the model — this is a policy, and it is cheaper than the reputation. |

### 4.3 Cleaning — included, never optional

Professional cleaning happens between every rental, on the way back, before the
garment reaches the lender. It is paid for by the platform out of the take rate
and is never presented to the borrower as a choice.

- **Not a checkbox at checkout.** Offering it as an add-on creates a decision at
  the exact moment a nervous borrower is deciding whether to trust a stranger
  with her Friday. It also makes the return date conditional, which the
  constraint engine cannot model honestly.
- **The garment is unavailable during it.** `cleaning_days` sits in the
  availability window alongside shipping and the rental period — a dress
  returned on Monday is not free on Monday.
- **The lender never handles it.** She is not running a business; if she has to
  take a dress to a dry cleaner she lists it once and never again.
- **Beyond a standard clean is a damage matter, not a cleaning one.** A stain
  that needs specialist treatment goes through the cover below, not silently
  onto the next borrower's timeline.

### 4.4 Cover — both sides, not just the lender

A lender hands a €900 gown to someone she has never met; a borrower pays in
advance for a garment she has never seen, from someone she has never met. **Both
of them are exposed, so both of them are covered.** Insuring only the lender
would treat the borrower as a risk to be managed rather than a customer.

| Covered party | Against | Mechanism |
|---|---|---|
| **Lender** | damage beyond fair wear, structural staining, and non-return | Per-rental cover up to the retail value she declared at listing. The borrower's deposit is authorised, not charged, as the excess, and released once the garment passes inspection at the cleaner. |
| **Borrower** | a garment that arrives damaged, soiled, materially different from its listing, or does not arrive in time | Full refund without a claim process, plus the cost of a replacement rental where one can still make the date. Her deposit is released immediately and she is never asked to prove the garment's prior condition. |

Supporting rules, in both directions:

- **Fair wear is not damage.** A loose hem, a missing bead, a seam that needs
  restitching are absorbed by the platform. A burn, a tear, a structural stain,
  or a garment that never comes back are claims. The line is published in
  advance; an undefined line means every case is argued individually and both
  parties lose.
- **Evidence at both ends:** the normalised listing photograph and a condition
  record at each inspection. This is where the photo pass in §4.5 earns its keep
  a second time — consistent lighting makes before-and-after actually comparable.
- **The lender is paid either way**, on schedule, whether or not a claim is open.
  Her income must never depend on a dispute she is not part of resolving, or she
  stops lending.
- **Cover exists because identity is verified.** Both sides are known people with
  matched payment methods (§2.4). Everything in this table would be unpriceable
  otherwise.

### 4.5 Photography — one AI pass, so a wardrobe looks like a shop

Lenders photograph on a bed, in a hallway, under a yellow bulb, at an angle. A
grid of those looks like a classifieds board, and a classifieds board does not
get rented from. The same model that writes the listing normalises the image.

| # | The pass | Why |
|---|---|---|
| 1 | Segment the garment and place it on a consistent neutral ground — the same off-white for every listing. | Background is the single largest source of visual chaos in peer-to-peer marketplaces. |
| 2 | Normalise crop, aspect and scale: one ratio, fixed padding, the garment occupying the same proportion of frame every time. | A grid reads as a collection when the eye does not have to re-anchor on each tile. |
| 3 | Correct exposure and white balance against a reference. | Not cosmetic. **Wrong white balance produces the wrong colour, and colour is a filter field** — a navy dress photographed under tungsten becomes unfindable. |
| 4 | Store a full-size listing image and a 400px thumbnail. | Grid performance, and a catalogue that loads on venue-grade wifi. |

> **The rule that makes this safe: normalise presentation; never alter the
> garment.** Correcting the light so a colour reads true is presentation.
> Deepening a colour, smoothing a fabric, removing a pull, a stain, a repair or
> a missing bead is altering the garment — and it converts a rental service into
> a misrepresentation. The corrected colour is shown back to the lender for
> confirmation before publishing, condition is always declared in words rather
> than inferred from a clean-looking photo, and the original photograph is kept
> unmodified as the record. It is also the borrower's evidence under §4.4: a
> retouched listing photo would quietly destroy her ability to claim.

### 4.6 Where the money sits

Adjacent to operations rather than part of it, but the numbers above only work
if this is decided: the borrower pays the rental price; the platform takes a cut
and pays for outbound delivery, the return leg, cleaning and cover out of it; the
lender receives the remainder on a fixed schedule after the garment is back and
inspected. Extension fees follow the same split. **Cleaning and cover being
inside the take rate — not add-ons — is what keeps the checkout a single
decision**, and a single decision is what a borrower two days from a wedding can
actually make.

> **None of this is built this weekend.** Verification, delivery, cleaning, cover
> and payment are modelled, not implemented — that is stated plainly in the
> README and said out loud if a judge asks. What *is* real is that the timings
> these operations imply are the timings the engine computes with, and they were
> written from how the operations would actually run. That is the difference
> between a modelled domain and invented numbers, and it is worth saying in
> exactly those words.

---

## 5. Beyond the first version

Deliberate next steps, in the order they make sense. Each is written with what it
costs as well as what it opens, because every one of them stretches the promise
the product is built on.

### 5.1 Worldwide delivery

**What it opens.** Supply and demand stop being limited by one city — a lender in
Hamburg can serve a wedding in Lisbon.

**What it costs.** The honesty about dates is the entire product, and it only
holds where lead times are modelled. Going worldwide is not a checkout setting;
it is modelling every new lane — customs, carrier reliability, weekend
calendars — before the agent is allowed to quote a date there. The correct
sequence is city, then country, then region. **A wrong delivery promise abroad
damages the product more than the absence of the market does.**

### 5.2 Subscriptions

**What it opens.** Two shapes, both for people who need occasion wear more than
once or twice a year: **up to five garments over the subscription period**, or a
lighter tier that includes **borrowed accessories** — bags, jewellery, wraps —
alongside a single garment.

**What it costs.** A subscription is a promise about availability made before
anybody knows what is available, which is the opposite of how this product
currently works. It needs either enough supply density that the promise is safe,
or a subscription that grants priority and price rather than guaranteed choice.
The second is honest at much lower scale and should come first.

### 5.3 Partnering with insurance companies

**What it opens.** The cover in §4.4 is currently self-funded out of the take
rate, which caps how much value the platform can carry. An underwriter lets
lenders list genuinely expensive pieces and lets the platform stop holding the
risk on its own balance sheet.

**What it costs.** An insurer will want verified identity, condition evidence and
claim history — all of which §2.4, §4.4 and §4.5 already produce. **That is the
argument for building verification and photo normalisation properly now**: they
are not only trust features, they are what makes this partnership possible later.

### 5.4 All genders

**What it opens.** Menswear and non-binary customers on both sides — formalwear
is at least as expensive per wear, and suits and dinner jackets are worn even
less often than gowns.

**What it costs.** More than a catalogue. Women-only is currently part of why a
lender is comfortable handing a garment to a stranger (§2.4), so opening up has
to be paired with stronger verification and a review system that carries real
weight, not just a wider sizing vocabulary. Do it after §5.3, when the cover is
underwritten rather than self-funded.

---

*Audience figures are the team's working assumptions for the first version, not
researched market data.*
