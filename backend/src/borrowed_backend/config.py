from datetime import date
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")
    demo_date: date | None = None
    catalog_path: Path = BACKEND_ROOT / "data/catalog.json"
    state_dir: Path = BACKEND_ROOT / "data/state"
    images_dir: Path = BACKEND_ROOT / "images"
