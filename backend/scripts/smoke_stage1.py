"""Exercise real HTTP, concurrent holds and a fresh process using temporary state."""

import asyncio
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time

import httpx

BACKEND = Path(__file__).resolve().parents[1]
SEARCH = {"city": "Hamburg", "sizes_eu": [38], "wear_date": "2026-09-18", "limit": 1000}


def main():
    catalog = BACKEND / "data/catalog.json"
    before = (catalog.stat().st_mtime_ns, hashlib.sha256(catalog.read_bytes()).hexdigest())
    with tempfile.TemporaryDirectory(prefix="borrowed-stage1-") as directory:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        env = {**os.environ, "PYTHONPATH": str(BACKEND / "src"),
               "STATE_DIR": str(Path(directory) / "state"), "DEMO_DATE": "2026-09-15"}
        command = [sys.executable, "-m", "borrowed_backend", "--demo-date", "2026-09-16",
                   "--port", str(port)]
        logs = Path(directory) / "service.log"

        def start(log):
            process = subprocess.Popen(command, env=env, cwd=BACKEND, stdout=log, stderr=log)
            try:
                with httpx.Client(base_url=base, trust_env=False) as client:
                    for _ in range(100):
                        if process.poll() is not None:
                            raise RuntimeError(logs.read_text())
                        try:
                            response = client.get("/health")
                            if response.status_code == 200:
                                return process
                        except httpx.TransportError:
                            pass
                        time.sleep(0.05)
                raise RuntimeError("Service startup timed out")
            except BaseException:
                stop(process)
                raise

        def stop(process):
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)

        with logs.open("w") as log:
            process = start(log)
            try:
                with httpx.Client(base_url=base, trust_env=False) as client:
                    health = client.get("/health").json()
                    assert health["today"] == "2026-09-16"
                    assert health["garments"] == 386
                    hits = client.post("/api/garments/search", json=SEARCH).json()
                    assert len(hits) == 22
                    garment_id = hits[0]["garment"]["id"]
                    assert client.get(hits[0]["garment"]["image"]).status_code == 200
                payload = {k: SEARCH[k] for k in ("city", "sizes_eu", "wear_date")}
                payload["garment_id"] = garment_id

                async def race():
                    async with httpx.AsyncClient(base_url=base, trust_env=False) as client:
                        return await asyncio.gather(*(client.post("/api/bookings", json={
                            **payload, "idempotency_key": f"smoke-{n}"}) for n in range(20)))

                responses = asyncio.run(race())
                winners = [n for n, response in enumerate(responses) if response.status_code == 200]
                assert len(winners) == 1
                conflicts = [response for response in responses if response.status_code == 409]
                assert len(conflicts) == 19
                assert all(response.json()["reason"] == "OVERLAPS_BOOKING" for response in conflicts)
                winner = winners[0]
                result = responses[winner].json()
                payload["idempotency_key"] = f"smoke-{winner}"
                with httpx.Client(base_url=base, trust_env=False) as client:
                    assert len(client.post("/api/garments/search", json=SEARCH).json()) == 21
                    assert client.get("/health").json()["bookings"] == health["bookings"] + 1
            finally:
                stop(process)
            process = start(log)
            try:
                with httpx.Client(base_url=base, trust_env=False) as client:
                    retry = client.post("/api/bookings", json=payload)
                    assert retry.status_code == 200
                    assert retry.json() == {**result, "already_existed": True}
                    after_hits = client.post("/api/garments/search", json=SEARCH).json()
                    assert len(after_hits) == 21
                    assert garment_id not in {hit["garment"]["id"] for hit in after_hits}
                    assert client.get("/health").json()["bookings"] == health["bookings"] + 1
            finally:
                stop(process)
    assert (catalog.stat().st_mtime_ns, hashlib.sha256(catalog.read_bytes()).hexdigest()) == before
    print(json.dumps({"status": "passed", "garments": 386, "feasible_before": 22,
                      "feasible_after": 21, "concurrent_successes": 1, "concurrent_conflicts": 19,
                      "process_restart_restored": True, "idempotent_retry_restored": True,
                      "cli_date_overrides_environment": True, "catalog_unchanged": True,
                      "catalog_sha256": before[1], "reserved_garment": garment_id}, indent=2))


if __name__ == "__main__":
    main()
