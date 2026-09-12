import asyncio
import hashlib
import json

import pytest

from borrowed_backend.data.store import InMemoryStore
from borrowed_backend.domain.errors import Conflict, IdempotencyConflict, PersistenceFailure
from borrowed_backend.domain.models import CreateBookingIn, SearchRequest
from borrowed_backend.tools.definitions import search_garments


def available_request(store, key="reserve-1"):
    req = SearchRequest(city="Hamburg", sizes_eu=[38], wear_date="2026-09-18")
    hit = asyncio.run(search_garments(store, req))[0]
    return CreateBookingIn(city=req.city, sizes_eu=req.sizes_eu, wear_date=req.wear_date,
                           garment_id=hit.garment.id, idempotency_key=key)


def test_booking_search_restart_and_seed_unchanged(store, settings):
    before = (settings.catalog_path.stat().st_mtime_ns,
              hashlib.sha256(settings.catalog_path.read_bytes()).hexdigest())
    req = available_request(store)
    result = asyncio.run(store.create_booking(req))
    assert result.status == "reserved" and result.payment_taken is False
    search = SearchRequest(city=req.city, sizes_eu=req.sizes_eu, wear_date=req.wear_date, limit=1000)
    assert req.garment_id not in {h.garment.id for h in asyncio.run(search_garments(store, search))}
    restarted = InMemoryStore(settings)
    assert result.booking_id in restarted.bookings
    assert req.garment_id not in {h.garment.id for h in asyncio.run(search_garments(restarted, search))}
    retry = asyncio.run(restarted.create_booking(req))
    assert retry == result.model_copy(update={"already_existed": True})
    assert (settings.catalog_path.stat().st_mtime_ns,
            hashlib.sha256(settings.catalog_path.read_bytes()).hexdigest()) == before


def test_twenty_concurrent_bookings(store):
    req = available_request(store)
    before = len(store.bookings)

    async def run():
        return await asyncio.gather(*(store.create_booking(req.model_copy(update={
            "idempotency_key": f"reservation-{n}"})) for n in range(20)), return_exceptions=True)

    outcomes = asyncio.run(run())
    successes = [r for r in outcomes if not isinstance(r, Exception)]
    conflicts = [r for r in outcomes if isinstance(r, Conflict)]
    assert len(successes) == 1
    assert len(conflicts) == 19
    assert all(c.feasibility.reason == "OVERLAPS_BOOKING" for c in conflicts)
    assert len(store.bookings) == before + 1
    assert len(store.reservations) == 1


def test_same_key_concurrently_and_normalization(store):
    req = available_request(store)

    async def run():
        return await asyncio.gather(*(store.create_booking(req) for _ in range(20)))

    results = asyncio.run(run())
    assert len({r.booking_id for r in results}) == 1
    assert sum(not r.already_existed for r in results) == 1
    equivalent = req.model_copy(update={"city": "hamburg", "sizes_eu": [38, 38],
                                        "return_date": results[0].wear_to})
    assert asyncio.run(store.create_booking(equivalent)).already_existed
    for update in ({"city": "Kiel"}, {"sizes_eu": [40]}, {"borrower_name": "Different"},
                   {"garment_id": "missing"}):
        with pytest.raises(IdempotencyConflict):
            asyncio.run(store.create_booking(req.model_copy(update=update)))


def test_city_and_size_rechecked(store):
    req = available_request(store)
    for update, reason in (({"city": "Kiel"}, "WRONG_CITY"), ({"sizes_eu": []}, "SIZE_MISMATCH")):
        with pytest.raises(Conflict) as caught:
            asyncio.run(store.create_booking(req.model_copy(update=update)))
        assert caught.value.feasibility.reason == reason
    assert not store.reservations


def test_snapshot_replace_failure_rolls_back(store, monkeypatch):
    req = available_request(store)
    first = asyncio.run(store.create_booking(req))
    previous_bytes = store.snapshot_path.read_bytes()
    second_req = available_request(store, "reserve-2")
    before_garments = store.garments.copy()
    before_bookings = store.bookings.copy()
    before_reservations = store.reservations.copy()

    def fail_replace(*args):
        raise OSError("Simulated disk failure")

    with monkeypatch.context() as patch:
        patch.setattr("borrowed_backend.data.snapshot.os.replace", fail_replace)
        with pytest.raises(PersistenceFailure):
            asyncio.run(store.create_booking(second_req))
    assert store.garments == before_garments
    assert store.bookings == before_bookings
    assert store.reservations == before_reservations
    assert store.snapshot_path.read_bytes() == previous_bytes
    assert not store.snapshot_path.with_suffix('.json.tmp').exists()
    assert asyncio.run(store.create_booking(second_req)).status == "reserved"
    assert first.booking_id in store.bookings


@pytest.mark.parametrize("mutation", ["duplicate", "hold", "garment", "request"])
def test_invalid_reservation_snapshot_fails_startup(store, settings, mutation):
    asyncio.run(store.create_booking(available_request(store)))
    payload = json.loads(store.snapshot_path.read_text())
    row = payload["reservations"][0]
    if mutation == "duplicate":
        payload["reservations"].append(row)
    elif mutation == "hold":
        row["booking"]["hold_to"] = "2026-10-01"
    elif mutation == "garment":
        row["booking"]["garment_id"] = "missing"
    else:
        row["request"]["garment_id"] = "missing"
    store.snapshot_path.write_text(json.dumps(payload))
    with pytest.raises(RuntimeError, match="Cannot restore"):
        InMemoryStore(settings)


def test_recheck_uses_garment_fetched_after_lock(store):
    req = available_request(store)

    async def run():
        await store._lock.acquire()
        pending = asyncio.create_task(store.create_booking(req))
        await asyncio.sleep(0)
        assert not pending.done()
        garment = store.get(req.garment_id)
        store.garments[garment.id] = garment.model_copy(update={"sizes_eu": [40]})
        store._lock.release()
        with pytest.raises(Conflict) as caught:
            await pending
        assert caught.value.feasibility.reason == "SIZE_MISMATCH"

    asyncio.run(run())
    assert not store.reservations
