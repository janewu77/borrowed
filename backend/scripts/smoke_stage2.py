"""Verify conversation SSE and process recovery with an explicitly scripted LLM."""

import argparse
from datetime import date
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


def serve(port, state_dir):
    import uvicorn
    from borrowed_backend.agents.state import DateReference, Extraction
    from borrowed_backend.config import Settings
    from borrowed_backend.main import create_app

    class SmokeLLM:
        async def extract(self, context):
            if context["text"] == "我周五要参加晚宴":
                return Extraction(wear_date=DateReference(weekday=4), occasion="gala")
            if context["text"] == "汉堡，EU 38":
                return Extraction(city="Hamburg", sizes_eu=[38])
            raise ValueError("Unexpected smoke input")

        async def text_stream(self, context):
            yield "请补充城市和 EU 尺码。" if context["kind"] == "question" else "确认后才会预约，不收取费用。"

        async def close(self):
            pass

    settings = Settings(demo_date=date(2026, 9, 16), state_dir=state_dir)
    uvicorn.run(create_app(settings, borrower_llm=SmokeLLM()), host="127.0.0.1", port=port, workers=1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--port", type=int)
    parser.add_argument("--state-dir", type=Path)
    args = parser.parse_args()
    if args.serve:
        serve(args.port, args.state_dir)
        return
    with tempfile.TemporaryDirectory(prefix="borrowed-stage2-") as directory:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = {**os.environ, "PYTHONPATH": str(BACKEND / "src")}
        command = [sys.executable, str(Path(__file__).resolve()), "--serve", "--port", str(port),
                   "--state-dir", str(Path(directory) / "state")]
        base = f"http://127.0.0.1:{port}"

        def stop(process):
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)

        with (Path(directory) / "service.log").open("w") as log:
            def start():
                process = subprocess.Popen(command, env=env, cwd=BACKEND, stdout=log, stderr=log)
                try:
                    with httpx.Client(base_url=base, trust_env=False, timeout=3) as client:
                        for _ in range(100):
                            if process.poll() is not None:
                                raise RuntimeError("Smoke server exited; inspect service configuration")
                            try:
                                if client.get("/health").status_code == 200:
                                    return process
                            except httpx.TransportError:
                                pass
                            time.sleep(0.05)
                    raise RuntimeError("Smoke server startup timed out")
                except BaseException:
                    stop(process)
                    raise

            def send(client, cid, payload):
                response = client.post(f"/api/conversations/{cid}/turn", json=payload)
                response.raise_for_status()
                events = {}
                for frame in response.text.split("\n\n"):
                    if frame.startswith("event:"):
                        name, data = frame.split("\n", 1)
                        events[name.removeprefix("event: ")] = json.loads(data.removeprefix("data: "))
                assert "done" in events
                return events

            process = start()
            try:
                with httpx.Client(base_url=base, trust_env=False) as client:
                    before = client.get("/health").json()["bookings"]
                    cid = client.post("/api/conversations", json={"role": "borrower"}).json()["conversation_id"]
                    first = send(client, cid, {"text": "我周五要参加晚宴"})
                    assert first["question"]["fields"] == ["city", "sizes_eu"]
                    results = send(client, cid, {"text": "汉堡，EU 38"})["results"]
                    payload = {"intent": "book", "garment_id": results["hits"][0]["garment"]["id"],
                               "result_id": results["result_id"], "confirmed": True}
                    rejected = send(client, cid, {**payload, "confirmed": False})
                    assert rejected["error"]["code"] == "CONFIRMATION_REQUIRED"
                    assert client.get("/health").json()["bookings"] == before
                    booked = send(client, cid, payload)["booking_claim"]["booking"]
                    assert client.get("/health").json()["bookings"] == before + 1
            finally:
                stop(process)
            process = start()
            try:
                with httpx.Client(base_url=base, trust_env=False) as client:
                    retry = send(client, cid, payload)["booking_claim"]["booking"]
                    assert retry == {**booked, "already_existed": True}
                    assert client.get("/health").json()["bookings"] == before + 1
                    hits = client.post("/api/garments/search", json={"city": "Hamburg", "sizes_eu": [38],
                                       "wear_date": "2026-09-18", "limit": 1000}).json()
                    assert payload["garment_id"] not in {hit["garment"]["id"] for hit in hits}
            finally:
                stop(process)
    print(json.dumps({"status": "passed", "transport": "real HTTP/SSE", "llm": "scripted; no OpenAI network call",
                      "missing_fields": first["question"]["fields"], "recommendations": len(results["hits"]),
                      "unconfirmed_booking_created": False, "booking_count_added": 1,
                      "process_restart_restored": True, "idempotent_retry_restored": True,
                      "booked_garment_removed_from_search": True}, indent=2))


if __name__ == "__main__":
    main()
