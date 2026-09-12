import argparse
from datetime import date

import uvicorn

from borrowed_backend.config import Settings
from borrowed_backend.main import create_app


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the single-process borrowed backend.")
    parser.add_argument("--demo-date", type=date.fromisoformat)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    settings = Settings()
    if args.demo_date:
        settings.demo_date = args.demo_date
    uvicorn.run(create_app(settings), host=args.host, port=args.port, workers=1)


if __name__ == "__main__":
    main()
