from datetime import date, timedelta

from .dates import compute_legs
from .enums import Reason
from .models import AvailabilityRequest, Feasibility, Garment


def check(garment: Garment, req: AvailabilityRequest, today: date) -> Feasibility:
    wear_to = req.return_date or req.wear_date + timedelta(days=garment.rental_days - 1)
    legs = compute_legs(req.wear_date, wear_to, garment.delivery_days,
                        garment.return_days, garment.cleaning_days)
    reason = None
    blocking_id = None
    if garment.city.casefold() != req.city.casefold():
        reason = Reason.WRONG_CITY
    elif garment.is_sized and not set(req.sizes_eu).intersection(garment.sizes_eu):
        reason = Reason.SIZE_MISMATCH
    elif today > legs.ship_by:
        reason = Reason.TOO_LATE_TO_SHIP
    elif not (garment.available_from <= legs.ship_by and legs.free_again <= garment.available_to):
        reason = Reason.OUTSIDE_LENDER_WINDOW
    else:
        for booking in garment.bookings:
            if not (legs.free_again < booking.hold_from or legs.ship_by > booking.hold_to):
                overlap_start = max(legs.ship_by, booking.hold_from)
                reason = (Reason.IN_CLEANING if overlap_start > booking.wear_to
                          else Reason.OVERLAPS_BOOKING)
                blocking_id = booking.id
                break
    return Feasibility(
        garment_id=garment.id, feasible=reason is None, reason=reason,
        ship_by=legs.ship_by, lands_on=legs.lands_on,
        wear_from=req.wear_date, wear_to=wear_to, free_again=legs.free_again,
        blocking_booking_id=blocking_id,
    )
