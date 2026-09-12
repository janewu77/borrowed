from typing import Annotated, Literal

from pydantic import Field, TypeAdapter

from borrowed_backend.domain.models import BookingResult, FrozenModel, SearchHit, Feasibility, GarmentPublic


class Token(FrozenModel):
    event: Literal["token"] = "token"
    text: str


class Question(FrozenModel):
    event: Literal["question"] = "question"
    text: str
    fields: list[str]


class Results(FrozenModel):
    event: Literal["results"] = "results"
    hits: list[SearchHit]
    relaxed: None = None
    result_id: str


class Availability(FrozenModel):
    event: Literal["availability"] = "availability"
    feasibility: Feasibility
    garment: GarmentPublic


class BookingClaim(FrozenModel):
    event: Literal["booking_claim"] = "booking_claim"
    booking: BookingResult


class Error(FrozenModel):
    event: Literal["error"] = "error"
    message: str
    recoverable: bool = True
    code: str


class Done(FrozenModel):
    event: Literal["done"] = "done"
    conversation_id: str


Event = Annotated[Token | Question | Results | Availability | BookingClaim | Error | Done,
                  Field(discriminator="event")]
EVENT_ADAPTER = TypeAdapter(Event)


def encode(event: Event) -> str:
    return f"event: {event.event}\ndata: {event.model_dump_json(exclude={'event'})}\n\n"
