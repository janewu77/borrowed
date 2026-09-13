import json
import logging
from datetime import date, timedelta
from pathlib import Path

from borrowed_backend.domain.dates import compute_legs
from borrowed_backend.domain.enums import Category, Occasion
from borrowed_backend.domain.models import Booking, Garment

logger = logging.getLogger(__name__)


def load_catalog(path: Path, today: date, images_dir: Path) -> dict[str, Garment]:
    with path.open("r", encoding="utf-8") as stream:
        rows = json.load(stream)
    garments = {}
    for row in rows:
        values = {key: row[key] for key in Garment.model_fields if key in row}
        for old, new in (("owner_id", "lender_id"), ("owner_name", "lender_name"),
                         ("owner_city", "city"), ("owner_rating", "lender_rating")):
            values[new] = row[old]
        values["lender_id"] = values["lender_id"].replace("owner-", "lender-", 1)
        occasions = []
        for raw in row["occasion"]:
            try:
                occasions.append(Occasion(raw.strip().casefold()))
            except ValueError:
                logger.warning("Unknown occasion omitted for garment %s", row["id"])
        values.update(
            occasion=occasions, is_sized=row["category"] == Category.DRESS,
            available_from=today, available_to=today + timedelta(days=120),
            image=f"/images/{row['id']}.jpg",
            thumb=(f"/images/thumbs/{row['id']}.jpg"
                   if (images_dir / "thumbs" / f"{row['id']}.jpg").is_file()
                   else f"/images/{row['id']}.jpg"),
        )
        # Each catalogue dress represents one lender-owned item, not shop stock.
        # Surface one concrete size even when the source storefront lists a range.
        if row["category"] == Category.DRESS.value:
            values["sizes_eu"] = values["sizes_eu"][:1]
        bookings = []
        for n, block in enumerate(row["booked"]):
            wear_from, wear_to = date.fromisoformat(block["from"]), date.fromisoformat(block["to"])
            legs = compute_legs(wear_from, wear_to, row["delivery_days"],
                                row["return_days"], row["cleaning_days"])
            bookings.append(Booking(
                id=f"seed-{row['id']}-{n}", garment_id=row["id"],
                wear_from=wear_from, wear_to=wear_to, hold_from=legs.ship_by,
                hold_to=legs.free_again, source="seed",
            ))
        garment = Garment(**values, bookings=bookings)
        if garment.id in garments:
            raise ValueError(f"Duplicate garment ID: {garment.id}")
        garments[garment.id] = garment
    return garments
