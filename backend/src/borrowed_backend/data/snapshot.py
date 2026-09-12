import json
import os
from pathlib import Path
from typing import Any, Literal

from borrowed_backend.domain.models import Booking, CreateBookingIn, FrozenModel


class PersistedReservation(FrozenModel):
    booking: Booking
    request: CreateBookingIn


class BookingSnapshot(FrozenModel):
    version: Literal[1] = 1
    reservations: list[PersistedReservation]


def write_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        with tmp.open("w", encoding="utf-8") as stream:
            json.dump(payload, stream, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)
