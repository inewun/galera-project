import json
from pathlib import Path
from typing import Any

from app.config import REPO_ROOT


HierarchyMap = dict[str, str | None]

DATA_DIR = REPO_ROOT / "data"
FILE_PATH = DATA_DIR / "hierarchy.json"
LEGACY_FILE_PATH = REPO_ROOT / "server" / "data" / "hierarchy.json"


def _is_valid_hierarchy(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    return all(isinstance(item, str) or item is None for item in value.values())


def _read_json(path: Path) -> HierarchyMap:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not _is_valid_hierarchy(value):
        raise ValueError("Invalid hierarchy: expected an object with string | null values")
    return value


async def read_hierarchy() -> HierarchyMap:
    try:
        if FILE_PATH.exists():
            return _read_json(FILE_PATH)

        if LEGACY_FILE_PATH.exists():
            legacy = _read_json(LEGACY_FILE_PATH)
            await write_hierarchy(legacy)
            return legacy

        return {}
    except Exception as exc:
        raise RuntimeError(f"Failed to read hierarchy file at {FILE_PATH}: {exc}") from exc


async def write_hierarchy(map_value: HierarchyMap) -> HierarchyMap:
    if not _is_valid_hierarchy(map_value):
        raise ValueError("Invalid hierarchy: expected an object with string | null values")

    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        FILE_PATH.write_text(json.dumps(map_value, ensure_ascii=False, indent=2), encoding="utf-8")
        return map_value
    except Exception as exc:
        raise RuntimeError(f"Failed to write hierarchy file at {FILE_PATH}: {exc}") from exc
