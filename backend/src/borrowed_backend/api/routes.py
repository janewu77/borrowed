from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from borrowed_backend.domain.models import (
    BookingResult, CheckAvailabilityIn, CreateBookingIn, Feasibility,
    GarmentPublic, SearchHit, SearchRequest,
)
from borrowed_backend.tools.registry import invoke

router = APIRouter()


@router.get("/health")
async def health(request: Request):
    store = request.app.state.store
    return {"status": "ok", "garments": len(store.garments),
            "bookings": len(store.bookings), "today": store.today()}


@router.post("/api/garments/search", response_model=list[SearchHit])
async def search(payload: SearchRequest, request: Request):
    return await invoke("search_garments", request.app.state.store, payload)


@router.get("/api/garments/{garment_id}", response_model=GarmentPublic)
async def garment(garment_id: str, request: Request):
    return await invoke("get_garment", request.app.state.store, {"garment_id": garment_id})


@router.get("/api/garments/{garment_id}/availability", response_model=Feasibility)
async def availability(
    garment_id: str, request: Request, wear: date, city: str,
    sizes_eu: Annotated[list[int], Query()] = [],
    return_date: Annotated[date | None, Query(alias="return")] = None,
):
    try:
        payload = CheckAvailabilityIn(garment_id=garment_id, wear_date=wear,
                                      return_date=return_date, city=city, sizes_eu=sizes_eu)
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from exc
    return await invoke("check_availability", request.app.state.store, payload)


@router.post("/api/bookings", response_model=BookingResult)
async def booking(payload: CreateBookingIn, request: Request):
    return await invoke("create_booking", request.app.state.store, payload)
