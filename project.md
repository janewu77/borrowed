# MORE

**More to wear. More to give. More to share.**

MORE is a hackathon prototype for a peer-to-peer occasion-wear rental platform. It helps people find an outfit for a specific event through a natural-language conversation, with availability and delivery timing checked before a garment is recommended. The application lives in the `borrowed/` directory.

The project is being developed for the AI.WOMEN Hackathon in Hamburg, September 12–13, 2026.

## The idea

An outfit bought for one special evening can spend years in a wardrobe. MORE aims to give those pieces more opportunities to be worn, while helping borrowers access occasion wear without buying something new for every event.

Finding a suitable outfit is only part of the problem. It must also fit, be available, and arrive before the occasion. MORE combines conversational search with explicit scheduling rules to address both style preferences and practical constraints.

## How it works

1. **Describe the occasion.** The borrower explains what they need in everyday language.
2. **Clarify the essentials.** The assistant gathers missing information, such as the event date, city, and size.
3. **Explore feasible options.** The backend checks eligibility and availability, then ranks suitable garments using preferences such as colour, occasion, and style.
4. **Confirm a reservation.** The borrower explicitly confirms a selected option. The backend checks availability again and creates a reservation hold. No payment is taken.

The availability calculation accounts for outbound delivery, the wear period, return transit, cleaning, and existing bookings. This makes the event deadline part of the search itself.

## The role of AI

AI interprets the borrower's request and supports the conversation. Deterministic Python code checks availability, ranks search results, and controls reservation creation.

The current conversation implementation uses the **OpenAI Responses API**, with **LangGraph** coordinating the borrower workflow. Availability decisions are grounded in backend rules rather than left to the language model.

## Current implementation

The implemented borrower flow includes structured garment search, text conversations, a web interface, explicit booking confirmation, and persistent reservation holds. Runtime bookings are stored in JSON snapshots so that they can survive a backend restart when the same state directory is retained.

The hackathon catalogue contains 386 items: 250 dresses and 136 accessories. It is based on public catalogue data from DCEY. Owners, bookings, rental and retail prices, and logistics timings are modelled for the demonstration. Catalogue images belong to their original source and are used for the hackathon demo.

The broader product vision includes helping lenders create listings from photos and conversational edits. Lender workflows, image understanding, and styling assistance remain planned features. The prototype does not implement accounts, payments, identity verification, insurance, or courier integration.

## Technology and structure

| Area | Current implementation |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | Python 3.12+, FastAPI, Pydantic |
| Conversation | OpenAI Responses API, LangGraph, server-sent events |
| Search and availability | Python domain rules |
| Storage | Catalogue JSON, in-memory state, JSON booking snapshots |

```text
borrowed/
  frontend/       Web application and borrower interface
  backend/        API, conversation workflow, availability rules, and tests
  docs/           Documentation index and deployment guides
  specs/          Product and backend specifications
```

The backend is designed for a single instance with one worker. It is a hackathon prototype, with no database or multi-process coordination.

## Further reading

- [Product story and vision](README.md)
- [Backend setup and API reference](backend/README.md)
- [Documentation index](docs/README.md)
- [Backend deployment guide](docs/backend-railway.readme.md)
- [Frontend deployment guide](docs/frontend-railway.readme.md)

The product README describes the wider vision and some earlier technical choices. This introduction reflects the current borrower implementation.
