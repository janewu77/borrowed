from datetime import date, datetime
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from .enums import Category, Occasion, Reason

NonEmpty = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
PositiveInt = Annotated[int, Field(strict=True, gt=0)]
NonNegativeInt = Annotated[int, Field(strict=True, ge=0)]


class FrozenModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class AvailabilityRequest(FrozenModel):
    city: NonEmpty
    wear_date: date
    return_date: date | None = None
    sizes_eu: list[PositiveInt]

    @model_validator(mode="after")
    def ordered_dates(self) -> Self:
        if self.return_date is not None and self.return_date < self.wear_date:
            raise ValueError("return_date must be on or after wear_date")
        return self


class SearchRequest(AvailabilityRequest):
    sizes_eu: list[PositiveInt] = Field(default_factory=list)
    category: Category = Category.DRESS
    occasion: Occasion | None = None
    colour_family: str | None = None
    style_hints: list[str] = Field(default_factory=list)
    max_price: NonNegativeInt | None = None
    limit: Annotated[int, Field(strict=True, ge=1, le=1000)] = 20


class CreateBookingIn(AvailabilityRequest):
    garment_id: NonEmpty
    borrower_name: str | None = None
    idempotency_key: NonEmpty


class GetGarmentIn(FrozenModel):
    garment_id: NonEmpty


class CheckAvailabilityIn(AvailabilityRequest):
    garment_id: NonEmpty


class Booking(FrozenModel):
    id: str
    garment_id: str
    wear_from: date
    wear_to: date
    hold_from: date
    hold_to: date
    borrower_name: str | None = None
    created_at: datetime | None = None
    idempotency_key: str | None = None
    source: Literal["seed", "runtime"]


class GarmentPublic(FrozenModel):
    id: str
    sku: str
    name: str
    name_raw: str
    designer: str
    category: Category
    silhouette: str | None
    colour_family: str | None
    occasion: list[Occasion]
    formality: int
    style_tags: list[str]
    sizes_eu: list[int]
    rental_price: NonNegativeInt
    retail_price: NonNegativeInt
    rental_days: PositiveInt
    image: str
    lender_id: str
    lender_name: str
    city: str
    lender_rating: float
    delivery_days: NonNegativeInt
    return_days: NonNegativeInt
    cleaning_days: NonNegativeInt
    condition: str
    description: str
    is_sized: bool
    available_from: date
    available_to: date
    thumb: str
    image_credit: str | None = None


class Garment(GarmentPublic):
    bookings: list[Booking] = Field(default_factory=list)
    source_url: str
    image_url: str

    def public(self) -> GarmentPublic:
        return GarmentPublic.model_validate(
            self.model_dump(include=set(GarmentPublic.model_fields))
        )


class Legs(FrozenModel):
    ship_by: date
    lands_on: date
    back_by: date
    free_again: date


class Feasibility(FrozenModel):
    garment_id: str
    feasible: bool
    ship_by: date
    lands_on: date
    wear_from: date
    wear_to: date
    free_again: date
    reason: Reason | None = None
    blocking_booking_id: str | None = None


class SearchHit(FrozenModel):
    garment: GarmentPublic
    feasibility: Feasibility
    score: float


class BookingResult(FrozenModel):
    booking_id: str
    garment_id: str
    ship_by: date
    lands_on: date
    wear_from: date
    wear_to: date
    free_again: date
    payment_taken: Literal[False] = False
    status: Literal["reserved"] = "reserved"
    already_existed: bool = False
