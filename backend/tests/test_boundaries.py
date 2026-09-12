import ast
from pathlib import Path

from borrowed_backend.config import Settings

SOURCE = Path(__file__).resolve().parents[1] / "src/borrowed_backend"


def test_source_boundaries():
    for path in SOURCE.rglob("*.py"):
        source = path.read_text()
        assert "renter" not in source
        assert '"user"' not in source
        assert "'user'" not in source
        if path.name != "loader.py":
            assert "owner" not in source
        if path.name != "store.py":
            assert "date.today()" not in source
        if path.parent.name == "domain":
            for node in ast.walk(ast.parse(source)):
                if isinstance(node, ast.ImportFrom):
                    assert not any(part in (node.module or "").split('.') for part in ("api", "data", "tools", "agents"))


def test_demo_date_environment(monkeypatch):
    monkeypatch.setenv("DEMO_DATE", "2026-09-16")
    assert Settings().demo_date.isoformat() == "2026-09-16"
