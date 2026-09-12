from enum import StrEnum


class Category(StrEnum):
    DRESS = "dress"
    JEWELLERY = "jewellery"
    BAG = "bag"


class Occasion(StrEnum):
    GALA = "gala"
    PARTY = "party"
    FORMAL = "formal"
    ENGAGEMENT = "engagement"
    WEDDING = "wedding"
    WEEKEND = "weekend"


class Reason(StrEnum):
    WRONG_CITY = "WRONG_CITY"
    SIZE_MISMATCH = "SIZE_MISMATCH"
    TOO_LATE_TO_SHIP = "TOO_LATE_TO_SHIP"
    OUTSIDE_LENDER_WINDOW = "OUTSIDE_LENDER_WINDOW"
    OVERLAPS_BOOKING = "OVERLAPS_BOOKING"
    IN_CLEANING = "IN_CLEANING"
