import json
from datetime import date

import pytest

from borrowed_backend.data.loader import load_catalog
from borrowed_backend.data.store import InMemoryStore
from borrowed_backend.domain.dates import compute_legs


def test_catalog(store):
    assert len(store.garments) == 386
    assert sum(len(ids) for ids in store.lenders.values()) == 386
    for garment in store.garments.values():
        assert type(garment.available_from) is date
        assert garment.available_from == store.today()
        assert garment.is_sized == (garment.category == "dress")
        assert garment.thumb == garment.image
        public = garment.public().model_dump()
        assert not {"source_url", "image_url", "bookings"} & public.keys()
        assert public["image_credit"] is None
        for booking in garment.bookings:
            legs = compute_legs(booking.wear_from, booking.wear_to, garment.delivery_days,
                                garment.return_days, garment.cleaning_days)
            assert (booking.hold_from, booking.hold_to) == (legs.ship_by, legs.free_again)


def test_unknown_occasion_and_duplicate(settings, tmp_path, caplog):
    rows = json.loads(settings.catalog_path.read_text())[:1]
    rows[0]["occasion"].append("unknown")
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(rows))
    assert len(load_catalog(path, settings.demo_date, settings.images_dir)) == 1
    assert "Unknown occasion" in caplog.text
    path.write_text(json.dumps(rows + rows))
    with pytest.raises(ValueError, match="Duplicate garment"):
        load_catalog(path, settings.demo_date, settings.images_dir)


def test_corrupt_snapshot(settings):
    settings.state_dir.mkdir()
    (settings.state_dir / "bookings.json").write_text('{"broken":true}')
    with pytest.raises(RuntimeError, match="Cannot restore"):
        InMemoryStore(settings)
