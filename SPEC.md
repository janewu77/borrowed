# borrowed — Product Specification

**Version 0.1 · updated 12 September 2026**

A peer-to-peer rental service for occasion wear.

---

## 1. The product

> **In one sentence:** borrowed is a peer-to-peer rental service for occasion
> wear where both sides talk to an agent instead of filling in forms, and where
> nothing is ever offered that cannot physically arrive in time.

### 1.1 What it does

A renter describes an occasion in ordinary words — *"a wedding in Hamburg on
Friday"* — and gets back three garments she can actually rent: in her size, free
on those dates, and deliverable before the event. She can attach a photo instead
of describing a style. The assistant asks for anything it needs and has not been
told, and it never searches on a guess.

An owner lists a garment by sending a photo. The model writes the listing —
category, colour, silhouette, occasion, formality, suggested size and rental
price — and she corrects it by replying in plain language: *"it's a 38"*,
*"booked the 20th to the 25th"*. Her piece becomes available to renters
immediately.

Between the two sits the part that is not conversational at all. Availability is
arithmetic — shipping time, the wear date, the return leg, the cleaning window,
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
- **It reasons about combinations.** A dress and a clutch from the same owner
  travel together — one delivery, and both have to arrive.

### 1.3 What it deliberately is not

| Not | Why |
|---|---|
| **A shop** | Garments belong to individual people, not to an inventory we own. That is what makes availability genuinely unpredictable, and therefore worth computing. |
| **Everyday rental** | A subscription wardrobe has no deadline, and without a deadline the entire premise collapses. Occasion wear is the only category where the date is real. |
| **A recommender** | The point is not taste. The point is truth about whether a specific garment can be worn on a specific day. |
| **A search interface with a chat skin** | If the conversation could be replaced by five dropdowns without loss, it would be the wrong product. |

---

## 2. Target audience

A marketplace has two audiences, but they are not equally weighted. The renter
with a dated event is who the product is designed around; the owner exists so
that supply is real. Everything below is the focus for the first version, not a
description of the eventual market.

### 2.1 Primary — the renter

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

### 2.2 Supply side — the owner

**A woman with occasion pieces she has worn once.** Two or three good garments
hanging in a wardrobe, bought for a specific event and unworn since. She is not
running a business and will not maintain an inventory system.

| | |
|---|---|
| Age | 28–45 |
| Where | Hamburg — same city as renters |
| Wardrobe | 1–5 listable pieces |
| Effort | under 2 min per listing, or she stops |
| Motive | the garment earns rather than hangs |
| Frequency | lists once, rents out occasionally |

### 2.3 The sharpest version of the focus

If the audience has to be one sentence: **a woman in Hamburg who has a dated
event within two weeks, needs one outfit for it, and would rather be told the
truth about delivery than shown a beautiful dress that will not arrive.** Every
feature is judged against her.

### 2.4 Who we deliberately do not serve yet

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
- **Menswear** — out of scope for the first version. The constraint engine does
  not care, but the catalogue and the vocabulary do.

> **One city, on purpose.** Delivery times are only trustworthy inside a region
> we can model. Hamburg first means the arithmetic is real rather than assumed —
> and a promise about Friday is the only thing this product actually sells.

---

## 3. User scenarios

One scenario per side of the marketplace. Each is written as it should behave in
the product, not as it behaves in the demo — where the two differ, the
difference is noted.

### 3.1 Scenario A — the owner lists a garment

**Lena, 34 — Hamburg, Eimsbüttel.** Wore an emerald floor-length gown to one
gala eighteen months ago. It cost €890 and has hung in a garment bag since. She
has thought about selling it and never got round to photographing it properly.

**Trigger.** A friend mentions she rented a dress for a wedding instead of
buying one. Lena opens borrowed on her phone that evening, with about two
minutes of attention and no intention of filling in a form.

| # | Lena does | The system does |
|---|---|---|
| 1 | Opens the owner chat and sends one photo of the gown on a hanger. | Accepts the image. **Saves it locally** at listing resolution — the listing needs a picture that still exists tomorrow. |
| 2 | Waits a few seconds. | **The model reads the photo and writes the listing:** category, colour family, silhouette, occasion tags, formality, style tags, an estimated size and a suggested rental price. It renders as a draft card in the conversation, not as a form. |
| 3 | Reads the card. The size is wrong and it does not know her calendar. She types: *"it's a 38, and it's booked the 20th to the 25th"*. | Parses the reply into a patch on the draft — `sizes_eu: [38]` and a booking range — and confirms in words what it changed. Nothing else on the card is disturbed. |
| 4 | Corrects the price: *"90 a rental"*. | Updates the price. If a field it needs is still empty it asks for that one field, and only that one. |
| 5 | Taps publish. | Adds the garment to the live catalogue with her name, city and rating attached. **It is findable by renters immediately** — no review queue, no approval step. |

**Outcome.** A complete, constraint-bearing listing exists in under two minutes,
and Lena never saw an input field. The dress is bookable by a stranger before
she puts her phone down.

**What this proves.** The model does work that a form cannot: it turns a
photograph and two casual sentences into structured data the availability engine
can compute with. Supply-side friction is the reason peer-to-peer marketplaces
die, and this is where it gets removed.

> **Scope note.** In the weekend build, the minimum version of this scenario is
> steps 1, 2, 3 and 5 — photo, auto-filled draft, one correction, publish. Step
> 4 and the system asking back for missing fields are the next increment, not
> the baseline.

### 3.2 Scenario B — the renter finds something that can arrive

**Mira, 29 — Hamburg, Altona.** A colleague's wedding on Friday. It is Wednesday
evening. She has spent forty minutes across three rental sites, has a tab open
on a dress she likes, and cannot work out whether it would reach her in time —
none of the sites will say.

**Trigger.** Two days out, no outfit, and the actual blocker is not choice — it
is that nobody will tell her the truth about delivery before she pays.

| # | Mira does | The system does |
|---|---|---|
| 1 | Types: *"I have a wedding in Hamburg on Friday."* | Extracts what it can — occasion `wedding`, city, a wear date resolved from "Friday" against today. Notes what is missing: size, and how formal. |
| 2 | Expects results. Gets a question instead. | **Does not search.** Asks for her size and whether it is indoors or outdoors, in one message. Without a date and a size, any list it produced would be a guess. |
| 3 | Answers: *"38, indoors, quite formal."* Then attaches a screenshot of a dress she saw: *"something like this."* | Reads the photo into the catalogue's own vocabulary — long, dark, unembellished, formality 4 — and says out loud what it saw. **The photo is used and discarded, never stored.** |
| 4 | Waits. | Applies the hard constraints **first**: size 38, free across shipping, wear, return and cleaning, and reachable before Friday. Ranks only the survivors by similarity to what it read from the photo. |
| 5 | Sees three dresses, each with the date it would land and a line explaining the match. | Renders the three, with owner, price, and a delivery date computed rather than promised. One of them was listed by Lena an hour earlier. |
| 6 | Notices the closest match to her screenshot is missing, and asks. | **Explains the compromise from facts, not from invention:** that dress is free, but in her size it cannot reach Hamburg before Saturday. Names the nearest alternative in shape and why it works. |
| 7 | Chooses one and asks about accessories. | Offers a clutch belonging to the same owner, so the two ship together, and confirms both clear the Friday deadline as one delivery. |
| 8 | Books it. | Writes the booking range onto the garment. It disappears from other renters' results for those dates **within the same second** — the constraint it just created is now enforced against everyone else. |

**Outcome.** Mira has an outfit that will arrive on Thursday, for about a tenth
of what the dress costs to buy, chosen in one conversation instead of across
three tabs. Nothing she was shown could have failed to arrive.

**What this proves.** Two things a search interface cannot do: noticing what it
has not been told and asking for it, and explaining a trade-off it did not
invent. Both sit on arithmetic done in code, which is what makes the explanation
trustworthy rather than fluent.

> **Scope note.** Steps 1, 2, 4, 5 and 6 are the core and are never cut. The
> photo in step 3 and the accessory in step 7 are the next increment. Step 8 —
> booking — is described here for completeness but is **not built for the
> weekend**: there is no payment, and a booking that takes no money is a claim
> rather than a transaction.

---

## 4. Operations — what runs under the hood

For the product team. The conversation is the visible half; this is the half
that makes its promises true.

> **The connection.** Every operational choice here becomes a field on a
> garment. `delivery_days`, `cleaning_days`, `return_days` and `condition` are
> not estimates we invented — they are what logistics, cleaning and inspection
> actually take. Change an operation and the dates the agent quotes change with
> it.

### 4.1 Delivery — the two legs

A rental is two journeys, not one. Out: owner to renter, before the wear date.
Back: renter to cleaner to owner. Only the first is visible to the renter, but
the second is what determines when the garment is free again.

| Decision | What it produces |
|---|---|
| **Tracked courier, regional, 1–2 working days.** Not same-day, not standard post. Prepaid return label goes in the box on the way out, so the renter never has to arrange anything. | `delivery_days` per garment, set from the owner's district. `return_days` for the journey back. |
| **One day of buffer is baked in and never shown.** The agent quotes the conservative date. Arriving a day early is a pleasant surprise; arriving on the morning of is a catastrophe. | The `ship_by` the agent quotes is `wear_date − delivery_days`, already conservative. |
| **The owner is told her ship-by date, not asked for one.** A reminder fires on that date. This is the single operational failure that destroys the product, because the whole promise is about a date. | Feeds the handover chain — the workflow that notifies the owner on the date the engine calculated. |
| **If the courier is late anyway:** the renter is told before she would otherwise find out, and the rental is refunded in full without a claim. A late dress is worthless, not partly worth it. | Nothing in the model — this is a policy, and it is cheaper than the reputation. |

### 4.2 Cleaning — included, never optional

Professional cleaning happens between every rental, on the way back, before the
garment reaches the owner. It is paid for by the platform out of the take rate
and is never presented to the renter as a choice.

- **Not a checkbox at checkout.** Offering it as an add-on creates a decision at
  the exact moment a nervous renter is deciding whether to trust a stranger with
  her Friday. It also makes the return date conditional, which the constraint
  engine cannot model honestly.
- **The garment is unavailable during it.** `cleaning_days` sits in the
  availability window alongside shipping and wear — a dress returned on Monday
  is not free on Monday.
- **The owner never handles it.** She is not running a business; if she has to
  take a dress to a dry cleaner she lists it once and never again.
- **Beyond a standard clean is a damage matter, not a cleaning one.** A stain
  that needs specialist treatment goes through the cover below, not silently
  onto the next renter's timeline.

### 4.3 Photography — one AI pass, so a wardrobe looks like a shop

Owners photograph on a bed, in a hallway, under a yellow bulb, at an angle. A
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
> a misrepresentation. The corrected colour is shown back to the owner for
> confirmation before publishing, condition is always declared in words rather
> than inferred from a clean-looking photo, and the original photograph is kept
> unmodified as the record. A renter who receives something that does not match
> the picture is a refund, a lost owner and a review, all at once.

### 4.4 Cover — what happens when something goes wrong

An owner lends a €900 gown to someone she has never met. The cover is not a
footnote; it is the reason she agrees at all, and it is the first thing she will
look for.

| Mechanism | Detail |
|---|---|
| **Per-rental cover, included in the price**, up to the retail value the owner declared when listing. | The declared value caps the cover, which is why the listing asks for it. It also anchors the suggested rental price. |
| **A deposit is authorised, not charged**, for the excess. Released automatically once the garment passes inspection at the cleaner. | An authorisation that quietly disappears is far easier to accept than a charge that has to be won back. |
| **Fair wear is not damage.** A loose hem, a missing bead, a seam that needs restitching are absorbed. A burn, a tear, a structural stain, or a garment that never comes back are claims. | The line is published in advance. An undefined line means every case is argued individually, and both parties lose. |
| **Evidence at both ends:** the normalised listing photograph and a condition record at each inspection. | This is where the photo pass earns its keep a second time — consistent lighting makes before-and-after actually comparable. |
| **The owner is paid either way**, on schedule, whether or not a claim is open. | Her rental income must never depend on a dispute she is not part of resolving, or she stops lending. |

### 4.5 Where the money sits

Adjacent to operations rather than part of it, but the numbers above only work
if this is decided: the renter pays the rental price; the platform takes a cut
and pays for outbound delivery, the return leg, cleaning and cover out of it;
the owner receives the remainder on a fixed schedule after the garment is back
and inspected. **Cleaning and cover being inside the take rate — not add-ons —
is what keeps the checkout a single decision**, and a single decision is what a
renter two days from a wedding can actually make.

> **None of this is built this weekend.** Delivery, cleaning, cover and payment
> are modelled, not implemented — that is stated plainly in the README and said
> out loud if a judge asks. What *is* real is that the timings these operations
> imply are the timings the engine computes with, and they were written from how
> the operations would actually run. That is the difference between a modelled
> domain and invented numbers, and it is worth saying in exactly those words.

---

*Audience figures are the team's working assumptions for the first version, not
researched market data.*
