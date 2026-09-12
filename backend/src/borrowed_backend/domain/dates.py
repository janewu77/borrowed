from datetime import date, timedelta

from .models import Legs

BUFFER_DAYS = 1


def compute_legs(
    wear_from: date, wear_to: date, delivery_days: int,
    return_days: int, cleaning_days: int,
) -> Legs:
    if wear_to < wear_from:
        raise ValueError("wear_to must be on or after wear_from")
    if min(delivery_days, return_days, cleaning_days) < 0:
        raise ValueError("Transit and cleaning durations must be nonnegative")
    ship_by = wear_from - timedelta(days=delivery_days + BUFFER_DAYS)
    back_by = wear_to + timedelta(days=return_days)
    return Legs(
        ship_by=ship_by, lands_on=ship_by + timedelta(days=delivery_days),
        back_by=back_by, free_again=back_by + timedelta(days=cleaning_days),
    )
