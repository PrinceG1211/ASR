from datetime import datetime, timezone
import json
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import HTTPException, status

from config import settings


_lock = Lock()


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def path_for(experiment_id: str) -> Path:
    return settings.experiments_dir / f"{experiment_id}.json"


def read(experiment_id: str) -> dict[str, Any]:
    path = path_for(experiment_id)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found.")
    return json.loads(path.read_text(encoding="utf-8"))


def create(experiment_id: str, stage: str) -> dict[str, Any]:
    timestamp = now()
    experiment = {"id": experiment_id, "status": "running", "stage": stage, "createdAt": timestamp, "updatedAt": timestamp}
    write(experiment)
    return experiment


def write(experiment: dict[str, Any]) -> dict[str, Any]:
    path = path_for(str(experiment["id"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(experiment, indent=2, ensure_ascii=False), encoding="utf-8")
        temporary.replace(path)
    return experiment


def update(experiment_id: str, **updates: Any) -> dict[str, Any]:
    experiment = read(experiment_id)
    experiment.update(updates)
    experiment["updatedAt"] = now()
    return write(experiment)


def fail(experiment_id: str, stage: str, error: Exception) -> dict[str, Any]:
    return update(experiment_id, status="failed", stage=stage, error=f"{type(error).__name__}: {error}")
