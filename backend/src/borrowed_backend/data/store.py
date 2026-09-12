import asyncio
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from borrowed_backend.config import Settings
from borrowed_backend.agents.state import BorrowerState, ConversationState
from pydantic import TypeAdapter
from borrowed_backend.domain.availability import check
from borrowed_backend.domain.dates import compute_legs
from borrowed_backend.domain.errors import Conflict, IdempotencyConflict, NotFound, PersistenceFailure
from borrowed_backend.domain.models import Booking, BookingResult, CreateBookingIn, Garment
from .loader import load_catalog
from .snapshot import BookingSnapshot, PersistedReservation, write_atomic


class InMemoryStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._lock = asyncio.Lock()
        self.garments = load_catalog(settings.catalog_path, self.today(), settings.images_dir)
        self.bookings = {b.id: b for g in self.garments.values() for b in g.bookings}
        self.reservations: dict[str, PersistedReservation] = {}
        self.lenders: dict[str, list[str]] = {}
        self.snapshot_path = settings.state_dir / "bookings.json"
        self._restore()
        self.conversations: dict[str, ConversationState] = {}
        self.conversation_locks: dict[str, asyncio.Lock] = {}
        self.conversation_path = settings.state_dir / "conversations.json"
        if self.conversation_path.exists():
            restored = TypeAdapter(list[ConversationState]).validate_json(
                self.conversation_path.read_text(encoding="utf-8"))
            self.conversations = {item.conversation_id: item for item in restored}
            if len(restored) != len(self.conversations):
                raise ValueError("Duplicate conversation IDs")
            self.conversation_locks = {key: asyncio.Lock() for key in self.conversations}
        for garment in self.garments.values():
            self.lenders.setdefault(garment.lender_id, []).append(garment.id)

    def today(self) -> date:
        return self.settings.demo_date or date.today()

    def get(self, garment_id: str) -> Garment:
        try:
            return self.garments[garment_id]
        except KeyError as exc:
            raise NotFound(garment_id) from exc

    def _restore(self) -> None:
        if self.snapshot_path.exists():
            try:
                snapshot = BookingSnapshot.model_validate_json(self.snapshot_path.read_text(encoding="utf-8"))
                for reservation in snapshot.reservations:
                    booking, req = reservation.booking, reservation.request
                    garment = self.get(booking.garment_id)
                    normalized = self._normalize(req, garment)
                    legs = compute_legs(req.wear_date, normalized.return_date, garment.delivery_days,
                                        garment.return_days, garment.cleaning_days)
                    if (booking.source != "runtime" or booking.id in self.bookings
                            or req.idempotency_key in self.reservations
                            or booking.idempotency_key != req.idempotency_key
                            or booking.garment_id != req.garment_id
                            or booking.wear_from != req.wear_date
                            or booking.wear_to != normalized.return_date
                            or booking.borrower_name != req.borrower_name
                            or booking.hold_from != legs.ship_by or booking.hold_to != legs.free_again):
                        raise ValueError("Inconsistent reservation snapshot")
                    self.bookings[booking.id] = booking
                    self.reservations[req.idempotency_key] = reservation.model_copy(update={"request": normalized})
            except (ValueError, OSError, NotFound) as exc:
                raise RuntimeError(f"Cannot restore booking snapshot: {self.snapshot_path}") from exc
        grouped = {garment_id: [] for garment_id in self.garments}
        for booking in self.bookings.values():
            grouped[booking.garment_id].append(booking)
        for garment_id, bookings in grouped.items():
            self.garments[garment_id] = self.garments[garment_id].model_copy(update={"bookings": bookings})

    @staticmethod
    def _normalize(req: CreateBookingIn, garment: Garment) -> CreateBookingIn:
        return req.model_copy(update={
            "city": req.city.casefold(), "sizes_eu": sorted(set(req.sizes_eu)),
            "return_date": req.return_date or req.wear_date + timedelta(days=garment.rental_days - 1),
        })

    @staticmethod
    def _result(booking: Booking, garment: Garment, existed: bool) -> BookingResult:
        legs = compute_legs(booking.wear_from, booking.wear_to, garment.delivery_days,
                            garment.return_days, garment.cleaning_days)
        return BookingResult(
            booking_id=booking.id, garment_id=booking.garment_id,
            ship_by=booking.hold_from, lands_on=legs.lands_on,
            wear_from=booking.wear_from, wear_to=booking.wear_to,
            free_again=booking.hold_to, already_existed=existed,
        )

    async def create_booking(self, req: CreateBookingIn) -> BookingResult:
        async with self._lock:
            existing = self.reservations.get(req.idempotency_key)
            if existing and existing.booking.garment_id != req.garment_id:
                raise IdempotencyConflict()
            garment = self.get(req.garment_id)
            normalized = self._normalize(req, garment)
            if existing:
                if existing.request != normalized:
                    raise IdempotencyConflict()
                return self._result(existing.booking, garment, True)
            feasibility = check(garment, normalized, self.today())
            if not feasibility.feasible:
                raise Conflict(feasibility)
            booking_id = f"bk-{uuid4().hex[:8]}"
            while booking_id in self.bookings:
                booking_id = f"bk-{uuid4().hex[:8]}"
            booking = Booking(
                id=booking_id, garment_id=garment.id,
                wear_from=feasibility.wear_from, wear_to=feasibility.wear_to,
                hold_from=feasibility.ship_by, hold_to=feasibility.free_again,
                borrower_name=req.borrower_name, created_at=datetime.now(timezone.utc),
                idempotency_key=req.idempotency_key, source="runtime",
            )
            self.bookings[booking.id] = booking
            self.garments[garment.id] = garment.model_copy(update={"bookings": [*garment.bookings, booking]})
            self.reservations[req.idempotency_key] = PersistedReservation(booking=booking, request=normalized)
            try:
                payload = BookingSnapshot(reservations=list(self.reservations.values()))
                write_atomic(self.snapshot_path, payload.model_dump(mode="json"))
            except Exception as exc:
                self.bookings.pop(booking.id)
                self.garments[garment.id] = garment
                self.reservations.pop(req.idempotency_key)
                raise PersistenceFailure("Booking snapshot could not be saved") from exc
            return self._result(booking, garment, False)

    async def save_conversation(self, conversation: ConversationState) -> None:
        async with self._lock:
            updated = {**self.conversations, conversation.conversation_id: conversation}
            try:
                write_atomic(self.conversation_path,
                             [item.model_dump(mode="json") for item in updated.values()])
            except Exception as exc:
                raise PersistenceFailure("Conversation snapshot could not be saved") from exc
            self.conversations = updated
            self.conversation_locks.setdefault(conversation.conversation_id, asyncio.Lock())

    async def checkpoint(self, conversation_id: str, state: BorrowerState) -> None:
        await self.save_conversation(self.conversations[conversation_id].model_copy(update={"slots": state}))
