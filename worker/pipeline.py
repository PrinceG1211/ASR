from typing import Any, Callable

from config import settings
from dataset import prepare_dataset
from experiment_store import fail, update
from baseline import run_baseline
from evaluate import run_evaluation
from finetune import run_finetune


def execute(stage: str, experiment_id: str, payload: dict[str, Any]) -> None:
    try:
        update(experiment_id, status="running", stage=stage)
        if stage == "prepare":
            prepare_dataset(experiment_id, int(payload.get("seed", settings.seed)))
        elif stage == "baseline":
            run_baseline(experiment_id, str(payload.get("model") or settings.checkpoint))
        elif stage == "finetune":
            run_finetune(experiment_id, str(payload.get("model") or settings.checkpoint), float(payload.get("epochs", 3)), float(payload.get("learningRate", 1e-5)), int(payload.get("batchSize", 4)), int(payload.get("seed", settings.seed)))
        elif stage == "evaluate":
            run_evaluation(experiment_id, str(payload.get("checkpoint") or ""))
        else:
            raise ValueError(f"Unsupported stage: {stage}")
    except Exception as error:
        fail(experiment_id, stage, error)
