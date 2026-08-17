from pathlib import Path

from baseline import evaluate_predictions, transcribe
from config import settings
from dataset import load_manifest
from experiment_store import read, update


def run_evaluation(experiment_id: str, checkpoint: str) -> dict:
    experiment = read(experiment_id)
    model = experiment.get("model") or {}
    expected_checkpoint = model.get("fineTunedCheckpoint")
    if not expected_checkpoint:
        raise RuntimeError("A real fine-tuned checkpoint is required before evaluation.")
    checkpoint_path = Path(str(expected_checkpoint))
    if not checkpoint_path.is_absolute():
        checkpoint_path = settings.data_root / checkpoint_path
    if not checkpoint_path.exists():
        raise RuntimeError(f"Fine-tuned checkpoint does not exist: {checkpoint_path}")
    rows = load_manifest(experiment_id, "test")
    if not rows:
        raise RuntimeError("The baseline held-out test manifest is empty.")
    output = settings.experiments_dir / f"{experiment_id}-finetuned-predictions.json"
    predictions = transcribe(str(checkpoint_path), rows, output)
    metrics = evaluate_predictions(predictions, "tuned")
    baseline = experiment.get("baseline") or {}
    if metrics.get("gap") is not None and baseline.get("gap") is not None:
        reduction = baseline["gap"] - metrics["gap"]
        metrics["gapReduction"] = reduction
        metrics["gapReductionPercent"] = reduction / baseline["gap"] * 100 if baseline["gap"] else None
    return update(experiment_id, status="complete", stage="evaluate", fineTuned=metrics)
