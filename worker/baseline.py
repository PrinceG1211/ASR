from collections import defaultdict
from pathlib import Path
from typing import Any

from jiwer import cer, wer

from config import settings
from dataset import TARGETS, load_manifest
from experiment_store import update


def transcribe(checkpoint: str, rows: list[dict[str, Any]], output_path: Path) -> list[dict[str, Any]]:
    import soundfile as sf
    import torch
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    processor = WhisperProcessor.from_pretrained(checkpoint, cache_dir=str(settings.model_cache))
    model = WhisperForConditionalGeneration.from_pretrained(checkpoint, cache_dir=str(settings.model_cache))
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    model.eval()
    results = []
    for row in rows:
        audio, sample_rate = sf.read(settings.data_root / row["audio_path"])
        inputs = processor(audio, sampling_rate=sample_rate, return_tensors="pt")
        with torch.no_grad():
            predicted_ids = model.generate(inputs.input_features.to(device))
        prediction = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()
        results.append({**row, "prediction": prediction})
    output_path.write_text(__import__("json").dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    return results


def evaluate_predictions(predictions: list[dict[str, Any]], prefix: str) -> dict[str, Any]:
    wer_key = f"{prefix}Wer"
    cer_key = f"{prefix}Cer"
    by_accent: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in predictions:
        by_accent[row["accent"]].append(row)
    accents = []
    for group, label in TARGETS.items():
        rows = by_accent.get(group, [])
        if not rows:
            accents.append({"accent": group, "label": label, "samples": 0, "speakers": 0, wer_key: None, cer_key: None})
            continue
        references = [row["sentence"] for row in rows]
        hypotheses = [row["prediction"] for row in rows]
        accents.append({"accent": group, "label": label, "samples": len(rows), "speakers": len({row["client_id"] for row in rows}), wer_key: wer(references, hypotheses), cer_key: cer(references, hypotheses)})
    valid = [row for row in accents if row[wer_key] is not None]
    wers = [row[wer_key] for row in valid]
    return {"accents": accents, "meanWer": sum(wers) / len(wers) if wers else None, "meanCer": sum(row[cer_key] for row in valid) / len(valid) if valid else None, "bestWer": min(wers) if wers else None, "worstWer": max(wers) if wers else None, "gap": max(wers) - min(wers) if wers else None}


def run_baseline(experiment_id: str, checkpoint: str) -> dict[str, Any]:
    import platform
    import torch

    rows = load_manifest(experiment_id, "test")
    if not rows:
        raise RuntimeError("The held-out test manifest is empty.")
    output = settings.experiments_dir / f"{experiment_id}-baseline-predictions.json"
    predictions = transcribe(checkpoint, rows, output)
    metrics = evaluate_predictions(predictions, "baseline")
    hardware = "cuda" if torch.cuda.is_available() else (platform.processor() or "cpu")
    return update(experiment_id, status="complete", stage="baseline", model={"baselineCheckpoint": checkpoint, "hardware": hardware}, baseline=metrics)
