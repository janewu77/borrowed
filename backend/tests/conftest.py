from datetime import date
from pathlib import Path

import pytest

from borrowed_backend.domain.models import Garment, AvailabilityRequest

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def garment():
    return Garment(
        id="test-dress", sku="test", name="Dress", name_raw="Dress", designer="Demo",
        category="dress", silhouette=None, colour_family=None, occasion=["gala"],
        formality=5, style_tags=[], sizes_eu=[38], rental_price=50, retail_price=100,
        rental_days=4, image="/images/test.jpg", thumb="/images/test.jpg",
        lender_id="lender-1", lender_name="Demo", city="Hamburg", lender_rating=4.7,
        delivery_days=1, return_days=2, cleaning_days=1, condition="excellent",
        description="", is_sized=True, available_from=date(2026, 9, 1),
        available_to=date(2027, 1, 1), source_url="", image_url="",
    )


@pytest.fixture
def request_window():
    return AvailabilityRequest(city="Hamburg", sizes_eu=[38], wear_date=date(2026, 9, 18))


@pytest.fixture
def settings(tmp_path):
    from borrowed_backend.config import Settings
    return Settings(demo_date=date(2026, 9, 16), catalog_path=BACKEND / "data/catalog.json",
                    state_dir=tmp_path / "state", images_dir=BACKEND / "images")


@pytest.fixture
def store(settings):
    from borrowed_backend.data.store import InMemoryStore
    return InMemoryStore(settings)
