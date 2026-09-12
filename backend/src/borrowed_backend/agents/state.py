from datetime import date, timedelta
from typing import Annotated, Literal

from pydantic import Field, model_validator

from borrowed_backend.domain.enums import Occasion
from borrowed_backend.domain.models import FrozenModel, NonEmpty, PositiveInt, NonNegativeInt, SearchRequest


class DateReference(FrozenModel):
    exact: date | None = None
    weekday: Annotated[int, Field(ge=0, le=6)] | None = None
    week_offset: Literal[0, 1] | None = None
    days_from_today: Annotated[int, Field(ge=0, le=365)] | None = None

    @model_validator(mode="after")
    def one_reference(self):
        if sum(v is not None for v in (self.exact, self.weekday, self.days_from_today)) != 1:
            raise ValueError("Exactly one date reference is required")
        if self.week_offset and self.weekday is None:
            raise ValueError("week_offset requires weekday")
        return self

    def resolve(self, today: date) -> date:
        if self.exact is not None:
            return self.exact
        if self.days_from_today is not None:
            return today + timedelta(days=self.days_from_today)
        if self.week_offset:
            return today + timedelta(days=7 - today.weekday() + self.weekday)
        return today + timedelta(days=(self.weekday - today.weekday()) % 7)


class Slots(FrozenModel):
    wear_date: date | None = None
    return_date: date | None = None
    city: NonEmpty | None = None
    sizes_eu: list[PositiveInt] | None = None
    occasion: Occasion | None = None
    colour_family: str | None = None
    style_hints: list[str] = Field(default_factory=list)
    max_price: NonNegativeInt | None = None

    def missing(self) -> list[str]:
        return [key for key in ("wear_date", "city", "sizes_eu") if not getattr(self, key)]

    def search_request(self) -> SearchRequest:
        return SearchRequest.model_validate(self.model_dump())


class Extraction(FrozenModel):
    wear_date: DateReference | None = None
    return_date: DateReference | None = None
    city: NonEmpty | None = None
    sizes_eu: list[PositiveInt] | None = None
    occasion: Occasion | None = None
    colour_family: str | None = None
    style_hints: list[str] | None = None
    max_price: NonNegativeInt | None = None
    clear_fields: list[Literal["wear_date", "return_date", "city", "sizes_eu", "occasion",
                               "colour_family", "style_hints", "max_price"]] = Field(default_factory=list)

    def merge(self, slots: Slots, today: date) -> Slots:
        values = slots.model_dump()
        for field in self.clear_fields:
            values[field] = [] if field == "style_hints" else None
        for field in type(self).model_fields:
            value = getattr(self, field)
            if field != "clear_fields" and value is not None:
                values[field] = value.resolve(today) if isinstance(value, DateReference) else value
        if values["wear_date"] != slots.wear_date and self.return_date is None:
            values["return_date"] = None
        return Slots.model_validate(values)


class Turn(FrozenModel):
    text: Annotated[str, Field(max_length=8000)] = ""
    intent: Literal["message", "book"] = "message"
    garment_id: NonEmpty | None = None
    confirmed: bool = False
    result_id: NonEmpty | None = None

    @model_validator(mode="after")
    def has_content(self):
        if self.intent == "message" and not self.text.strip():
            raise ValueError("text is required for a message turn")
        return self


class BorrowerState(FrozenModel):
    slots: Slots = Field(default_factory=Slots)
    result_ids: list[str] = Field(default_factory=list)
    result_id: str | None = None
    result_request: SearchRequest | None = None
    last_node: str = "created"


class ConversationState(FrozenModel):
    conversation_id: str
    role: Literal["borrower"] = "borrower"
    slots: BorrowerState = Field(default_factory=BorrowerState)
