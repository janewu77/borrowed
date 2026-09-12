import asyncio

import pytest
from fastapi.testclient import TestClient

from borrowed_backend.main import create_app
from borrowed_backend.tools.registry import REGISTRY, invoke

SEARCH = {"city": "Hamburg", "sizes_eu": [38], "wear_date": "2026-09-18", "limit": 1000}


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as client:
        yield client


def test_http_flow_and_registry(client, settings):
    assert set(REGISTRY) == {"search_garments", "get_garment", "check_availability", "create_booking"}
    assert client.get("/health").json()["garments"] == 386
    assert client.get("/health").json()["today"] == "2026-09-16"
    response = client.post("/api/garments/search", json=SEARCH)
    assert response.status_code == 200
    hits = response.json()
    assert len(hits) == 22
    direct = asyncio.run(invoke("search_garments", client.app.state.store, SEARCH))
    assert hits == [hit.model_dump(mode="json") for hit in direct]
    garment = hits[0]["garment"]
    garment_id = garment["id"]
    assert client.get(f"/api/garments/{garment_id}").json() == garment
    assert client.get(garment["image"]).headers["content-type"] == "image/jpeg"
    availability = client.get(f"/api/garments/{garment_id}/availability", params={
        "wear": "2026-09-18", "return": "2026-09-21", "city": "Hamburg", "sizes_eu": 38})
    assert availability.status_code == 200 and availability.json()["feasible"]
    payload = {k: SEARCH[k] for k in ("city", "sizes_eu", "wear_date")}
    payload.update(garment_id=garment_id, idempotency_key="api-test", borrower_name="Borrower Demo")
    booked = client.post("/api/bookings", json=payload)
    assert booked.status_code == 200
    assert booked.json()["payment_taken"] is False
    assert client.post("/api/bookings", json=payload).json()["already_existed"]
    reused = client.post("/api/bookings", json={**payload, "city": "Kiel"})
    assert reused.status_code == 409 and reused.json()["reason"] == "IDEMPOTENCY_KEY_REUSED"
    conflict = client.post("/api/bookings", json={**payload, "idempotency_key": "other"})
    assert conflict.status_code == 409 and conflict.json()["reason"] == "OVERLAPS_BOOKING"
    assert conflict.json()["feasibility"]["blocking_booking_id"] == booked.json()["booking_id"]
    assert len(client.post("/api/garments/search", json=SEARCH).json()) == 21
    with TestClient(create_app(settings)) as restarted:
        assert restarted.post("/api/bookings", json=payload).json()["already_existed"]
        assert len(restarted.post("/api/garments/search", json=SEARCH).json()) == 21


@pytest.mark.parametrize("update", [
    {"wear_date": "invalid"}, {"return_date": "2026-09-17"}, {"city": " "},
    {"sizes_eu": [-1]}, {"limit": 0}, {"max_price": -1}, {"include_infeasible": True},
    {"wear_date": "0001-01-01"}, {"wear_date": "9999-12-31"},
])
def test_bad_search_requests(client, update):
    assert client.post("/api/garments/search", json={**SEARCH, **update}).status_code == 422


def test_bad_booking_and_availability(client):
    assert client.post("/api/bookings", json={}).status_code == 422
    assert client.get("/api/garments/missing").status_code == 404
    base = {"wear_date": "2026-09-18", "city": "Hamburg", "sizes_eu": [38],
            "garment_id": "missing", "idempotency_key": "test"}
    assert client.post("/api/bookings", json=base).status_code == 404
    for field in ("city", "sizes_eu", "idempotency_key"):
        assert client.post("/api/bookings", json={k: v for k, v in base.items() if k != field}).status_code == 422
    for params in ({"wear": "2026-09-18", "return": "2026-09-17", "city": "Hamburg"},
                   {"wear": "2026-09-18", "city": " "},
                   {"wear": "2026-09-18", "city": "Hamburg", "sizes_eu": -1}):
        assert client.get("/api/garments/item-0000/availability", params=params).status_code == 422


def test_persistence_error_http(client, monkeypatch):
    garment_id = client.post("/api/garments/search", json=SEARCH).json()[0]["garment"]["id"]

    def fail(*args):
        raise OSError("Disk unavailable")

    monkeypatch.setattr("borrowed_backend.data.store.write_atomic", fail)
    response = client.post("/api/bookings", json={
        "city": "Hamburg", "sizes_eu": [38], "wear_date": "2026-09-18",
        "garment_id": garment_id, "idempotency_key": "failed",
    })
    assert response.status_code == 503 and response.json()["reason"] == "PERSISTENCE_FAILED"
    assert len(client.post("/api/garments/search", json=SEARCH).json()) == 22
