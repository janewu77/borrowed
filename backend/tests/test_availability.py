from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from borrowed_backend.domain.availability import check
from borrowed_backend.domain.dates import compute_legs
from borrowed_backend.domain.models import AvailabilityRequest, Booking

TODAY = date(2026, 9, 16)


def test_golden(garment, request_window):
    result = check(garment, request_window, TODAY)
    legs = compute_legs(date(2026, 9, 18), result.wear_to, 1, 2, 1)
    assert result.feasible
    assert result.ship_by == date(2026, 9, 16)
    assert result.lands_on == date(2026, 9, 17)
    assert result.wear_to == date(2026, 9, 21)
    assert legs.back_by == date(2026, 9, 23)
    assert result.free_again == date(2026, 9, 24)
    assert (result.free_again - result.ship_by).days + 1 == 9


def test_deadline(garment, request_window):
    assert check(garment, request_window, TODAY).feasible
    assert check(garment, request_window, TODAY + timedelta(days=1)).reason == "TOO_LATE_TO_SHIP"


def test_delivery_durations(garment, request_window):
    assert [check(garment.model_copy(update={"delivery_days": n}), request_window, TODAY).ship_by
            for n in (1, 2, 3)] == [date(2026, 9, n) for n in (16, 15, 14)]


def test_unsized_and_casefold(garment, request_window):
    bag = garment.model_copy(update={"is_sized": False, "category": "bag", "sizes_eu": []})
    assert check(bag, request_window.model_copy(update={"city": "hamburg"}), TODAY).feasible
    assert check(garment, request_window.model_copy(update={"sizes_eu": []}), TODAY).reason == "SIZE_MISMATCH"


def test_reason_priority_and_window(garment, request_window):
    req = request_window.model_copy(update={"city": "Kiel", "sizes_eu": []})
    assert check(garment, req, TODAY + timedelta(days=10)).reason == "WRONG_CITY"
    req = req.model_copy(update={"city": "Hamburg"})
    assert check(garment, req, TODAY + timedelta(days=10)).reason == "SIZE_MISMATCH"
    narrow = garment.model_copy(update={"available_to": date(2026, 9, 23)})
    assert check(narrow, request_window, TODAY).reason == "OUTSIDE_LENDER_WINDOW"


@pytest.mark.parametrize('start,end,wear_end,expected', [
    (24, 29, 26, 'OVERLAPS_BOOKING'),
    (10, 16, 13, 'IN_CLEANING'),
    (10, 18, 17, 'OVERLAPS_BOOKING'),
    (25, 29, 26, None),
])
def test_inclusive_overlap(garment, request_window, start, end, wear_end, expected):
    booking = Booking(id="seed-test", garment_id=garment.id, wear_from=date(2026, 9, 12),
                      wear_to=date(2026, 9, wear_end), hold_from=date(2026, 9, start),
                      hold_to=date(2026, 9, end), source="seed")
    result = check(garment.model_copy(update={"bookings": [booking]}), request_window, TODAY)
    assert result.reason == expected
    assert result.blocking_booking_id == (booking.id if expected else None)


def test_invalid_end_date():
    with pytest.raises(ValidationError):
        AvailabilityRequest(city="Hamburg", sizes_eu=[38], wear_date="2026-09-18", return_date="2026-09-17")
