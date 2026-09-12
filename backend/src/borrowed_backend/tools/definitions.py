from borrowed_backend.data.store import InMemoryStore
from borrowed_backend.domain.availability import check
from borrowed_backend.domain.models import (
    BookingResult, CheckAvailabilityIn, CreateBookingIn, Feasibility,
    GarmentPublic, GetGarmentIn, SearchHit, SearchRequest,
)
from borrowed_backend.domain.ranking import score
from .registry import tool


@tool(name="search_garments", description="Find garments available for the requested place, size and dates.",
      input=SearchRequest, output=list[SearchHit])
async def search_garments(store: InMemoryStore, req: SearchRequest) -> list[SearchHit]:
    hits = []
    today = store.today()
    for garment in store.garments.values():
        if garment.category != req.category:
            continue
        feasibility = check(garment, req, today)
        if not feasibility.feasible:
            continue
        if req.max_price is not None and garment.rental_price > req.max_price:
            continue
        hits.append(SearchHit(garment=garment.public(), feasibility=feasibility, score=score(garment, req)))
    hits.sort(key=lambda hit: (-hit.score, hit.garment.rental_price, hit.garment.id))
    return hits[:req.limit]


@tool(name="get_garment", description="Get garment details.", input=GetGarmentIn, output=GarmentPublic)
async def get_garment(store: InMemoryStore, req: GetGarmentIn) -> GarmentPublic:
    return store.get(req.garment_id).public()


@tool(name="check_availability", description="Check whether a garment can be borrowed for these dates.",
      input=CheckAvailabilityIn, output=Feasibility)
async def check_availability(store: InMemoryStore, req: CheckAvailabilityIn) -> Feasibility:
    return check(store.get(req.garment_id), req, store.today())


@tool(name="create_booking", description=(
    "Places a **real hold** on the garment for these dates. The garment immediately "
    "becomes unavailable to every other borrower. **No payment is taken and no card is "
    "charged** — this reserves the item only."
), input=CreateBookingIn, output=BookingResult, scope="booking:write")
async def create_booking(store: InMemoryStore, req: CreateBookingIn) -> BookingResult:
    return await store.create_booking(req)
