from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import platform
import sys
import time
from collections import defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
EXPERIMENTS_DIR = DATA_DIR / "experiments"
MANIFEST_DIR = DATA_DIR / "manifests"
AUDIO_DIR = DATA_DIR / "audio"
TARGETS = {
    "american": "American English",
    "indian": "Indian English",
    "nigerian": "Nigerian English",
    "scottish": "Scottish English",
}


@dataclass
class Sample:
    sample_id: str
    client_id: str
    accent: str
    sentence: str
    audio_path: str
    duration_seconds: float
    split: str


def accent_group(value: Any) -> str | None:
    normalized = str(value or "").strip().lower()
    aliases = {
        "american": ("american", "united states", "usa", "us"),
        "indian": ("indian", "india", "in"),
        "nigerian": ("nigerian", "nigeria", "ng"),
        "scottish": ("scottish", "scotland", "sco"),
    }
    for group, values in aliases.items():
        if normalized in values or any(value in normalized for value in values if len(value) > 2):
            return group
    return None


def speaker_split(client_id: str, seed: int) -> str:
    digest = hashlib.sha256(f"{seed}:{client_id}".encode()).hexdigest()
    bucket = int(digest[:8], 16) % 100
    if bucket < 80:
        return "train"
    if bucket < 90:
        return "validation"
    return "test"


def ensure_dirs() -> None:
    for directory in (DATA_DIR, EXPERIMENTS_DIR, MANIFEST_DIR, AUDIO_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def latest_experiment() -> dict[str, Any] | None:
    candidates = sorted(EXPERIMENTS_DIR.glob("*.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    return read_json(candidates[0]) if candidates else None


def save_experiment(experiment: dict[str, Any]) -> None:
    ensure_dirs()
    write_json(EXPERIMENTS_DIR / f"{experiment['id']}.json", experiment)


def update_experiment(experiment_id: str, **updates: Any) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / f"{experiment_id}.json"
    experiment = read_json(path)
    experiment.update(updates)
    experiment["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    save_experiment(experiment)
    return experiment


def prepare_dataset(args: argparse.Namespace) -> None:
    ensure_dirs()
    experiment_id = args.experiment_id or time.strftime("%Y%m%d%H%M%S", time.gmtime())
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    experiment = {"id": experiment_id, "status": "running", "stage": "dataset", "createdAt": now, "updatedAt": now}
    save_experiment(experiment)
    try:
        from datasets import Audio, load_dataset
        import soundfile as sf

        dataset = load_dataset("mozilla-foundation/common_voice_17_0", "en", split="train", trust_remote_code=True)
        if "audio" not in dataset.column_names or "client_id" not in dataset.column_names:
            raise RuntimeError("The loaded Common Voice version does not expose audio and client_id columns.")
        dataset = dataset.cast_column("audio", Audio(sampling_rate=None))
        rows: list[Sample] = []
        for index, item in enumerate(dataset):
            group = accent_group(item.get("accent"))
            sentence = str(item.get("sentence") or "").strip()
            client_id = str(item.get("client_id") or "").strip()
            audio = item.get("audio") or {}
            array = audio.get("array")
            sample_rate = int(audio.get("sampling_rate") or 0)
            if not group or not sentence or not client_id or array is None or sample_rate <= 0:
                continue
            sample_id = f"{group}-{index}"
            audio_path = AUDIO_DIR / f"{sample_id}.wav"
            if not audio_path.exists():
                sf.write(audio_path, array, sample_rate)
            rows.append(Sample(sample_id, client_id, group, sentence, str(audio_path.relative_to(ROOT)), len(array) / sample_rate, speaker_split(client_id, args.seed)))
        if not rows:
            raise RuntimeError("No valid Common Voice samples with the requested accent metadata were found.")
        manifest = MANIFEST_DIR / f"{experiment_id}.jsonl"
        with manifest.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(asdict(row), ensure_ascii=False) + "\n")
        stats: dict[str, dict[str, Any]] = defaultdict(lambda: {"speakers": set(), "samples": 0, "durationSeconds": 0.0, "trainSamples": 0, "validationSamples": 0, "testSamples": 0})
        for row in rows:
            entry = stats[row.accent]
            entry["speakers"].add(row.client_id)
            entry["samples"] += 1
            entry["durationSeconds"] += row.duration_seconds
            entry[f"{row.split}Samples"] += 1
        accents = [{"accent": group, "label": TARGETS[group], "speakers": len(stats[group]["speakers"]), "samples": stats[group]["samples"], "durationSeconds": round(stats[group]["durationSeconds"], 3), "trainSamples": stats[group]["trainSamples"], "validationSamples": stats[group]["validationSamples"], "testSamples": stats[group]["testSamples"]} for group in TARGETS]
        available = {entry["accent"] for entry in accents if entry["samples"] > 0}
        summary = {"dataset": "Mozilla Common Voice", "version": "17.0", "language": "en", "accents": accents, "speakers": len({row.client_id for row in rows}), "samples": len(rows), "durationSeconds": round(sum(row.duration_seconds for row in rows), 3), "trainSamples": sum(row.split == "train" for row in rows), "validationSamples": sum(row.split == "validation" for row in rows), "testSamples": sum(row.split == "test" for row in rows), "insufficientAccents": [group for group in TARGETS if group not in available], "generatedAt": now, "manifest": str(manifest.relative_to(ROOT))}
        update_experiment(experiment_id, status="complete", stage="dataset", dataset=summary)
    except Exception as error:
        update_experiment(experiment_id, status="failed", stage="dataset", error=f"{type(error).__name__}: {error}")
        raise


def load_manifest(experiment_id: str, split: str | None = None) -> list[dict[str, Any]]:
    path = MANIFEST_DIR / f"{experiment_id}.jsonl"
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found for experiment {experiment_id}. Run prepare first.")
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return [row for row in rows if split is None or row["split"] == split]


def transcribe(checkpoint: str, rows: list[dict[str, Any]], output_path: Path) -> list[dict[str, Any]]:
    import torch
    import soundfile as sf
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    processor = WhisperProcessor.from_pretrained(checkpoint)
    model = WhisperForConditionalGeneration.from_pretrained(checkpoint)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    results = []
    for row in rows:
        audio, sample_rate = sf.read(ROOT / row["audio_path"])
        inputs = processor(audio, sampling_rate=sample_rate, return_tensors="pt")
        input_features = inputs.input_features.to(device)
        with torch.no_grad():
            predicted_ids = model.generate(input_features)
        prediction = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()
        results.append({**row, "prediction": prediction})
    write_json(output_path, results)
    return results


def evaluate_predictions(predictions: list[dict[str, Any]]) -> dict[str, Any]:
    from jiwer import cer, wer

    by_accent: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in predictions:
        by_accent[row["accent"]].append(row)
    stats = []
    for group in TARGETS:
        rows = by_accent.get(group, [])
        if not rows:
            stats.append({"accent": group, "label": TARGETS[group], "samples": 0, "speakers": 0, "baselineWer": None, "baselineCer": None})
            continue
        stats.append({"accent": group, "label": TARGETS[group], "samples": len(rows), "speakers": len({row["client_id"] for row in rows}), "baselineWer": wer([row["sentence"] for row in rows], [row["prediction"] for row in rows]), "baselineCer": cer([row["sentence"] for row in rows], [row["prediction"] for row in rows])})
    valid = [row for row in stats if row["baselineWer"] is not None]
    wers = [row["baselineWer"] for row in valid]
    return {"accents": stats, "meanWer": sum(wers) / len(wers) if wers else None, "meanCer": sum(row["baselineCer"] for row in valid) / len(valid) if valid else None, "bestWer": min(wers) if wers else None, "worstWer": max(wers) if wers else None, "gap": max(wers) - min(wers) if wers else None}


def run_baseline(args: argparse.Namespace) -> None:
    try:
        rows = load_manifest(args.experiment_id, "test")
        output = EXPERIMENTS_DIR / f"{args.experiment_id}-baseline-predictions.json"
        predictions = transcribe(args.checkpoint, rows, output)
        metrics = evaluate_predictions(predictions)
        update_experiment(args.experiment_id, status="complete", stage="baseline", model={"baselineCheckpoint": args.checkpoint, "hardware": "cuda" if os.environ.get("CUDA_VISIBLE_DEVICES") else platform.processor()}, baseline=metrics)
    except Exception as error:
        update_experiment(args.experiment_id, status="failed", stage="baseline", error=f"{type(error).__name__}: {error}")
        raise


def run_finetune(args: argparse.Namespace) -> None:
    try:
        import torch
        import soundfile as sf
        from datasets import Dataset
        from transformers import WhisperForConditionalGeneration, WhisperProcessor, Seq2SeqTrainer, Seq2SeqTrainingArguments
    except Exception as error:
        update_experiment(args.experiment_id, status="failed", stage="finetune", error=f"{type(error).__name__}: {error}")
        raise

    train_rows = load_manifest(args.experiment_id, "train")
    validation_rows = load_manifest(args.experiment_id, "validation")
    if not train_rows or not validation_rows:
        raise RuntimeError("Speaker-safe train and validation rows are required before fine-tuning.")
    counts = defaultdict(int)
    for row in train_rows:
        counts[row["accent"]] += 1
    target_count = min(counts.values())
    balanced_rows = []
    for group in TARGETS:
        group_rows = [row for row in train_rows if row["accent"] == group]
        balanced_rows.extend(group_rows[:target_count])
    if not balanced_rows:
        raise RuntimeError("No valid accent groups are available for balanced fine-tuning.")

    processor = WhisperProcessor.from_pretrained(args.checkpoint)
    model = WhisperForConditionalGeneration.from_pretrained(args.checkpoint)
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    def encode(row: dict[str, Any]) -> dict[str, Any]:
        audio, sample_rate = sf.read(ROOT / row["audio_path"])
        features = processor(audio, sampling_rate=sample_rate).input_features[0]
        labels = processor.tokenizer(row["sentence"]).input_ids
        return {"input_features": features, "labels": labels}

    train_dataset = Dataset.from_list([encode(row) for row in balanced_rows])
    validation_dataset = Dataset.from_list([encode(row) for row in validation_rows])

    class DataCollator:
        def __call__(self, features: list[dict[str, Any]]) -> dict[str, Any]:
            input_features = torch.tensor([feature["input_features"] for feature in features], dtype=torch.float32)
            label_features = [{"input_ids": feature["labels"]} for feature in features]
            labels = processor.tokenizer.pad(label_features, return_tensors="pt").input_ids
            labels = labels.masked_fill(labels == processor.tokenizer.pad_token_id, -100)
            return {"input_features": input_features, "labels": labels}

    output_dir = ROOT / "data" / "models" / args.experiment_id
    training_args = Seq2SeqTrainingArguments(output_dir=str(output_dir), per_device_train_batch_size=args.batch_size, per_device_eval_batch_size=args.batch_size, learning_rate=args.learning_rate, num_train_epochs=args.epochs, seed=args.seed, fp16=torch.cuda.is_available(), evaluation_strategy="epoch", save_strategy="epoch", logging_strategy="steps", logging_steps=10, predict_with_generate=True, report_to=[])
    trainer = Seq2SeqTrainer(model=model, args=training_args, train_dataset=train_dataset, eval_dataset=validation_dataset, data_collator=DataCollator(), tokenizer=processor.feature_extractor)
    started = time.time()
    trainer.train()
    trainer.save_model(str(output_dir))
    processor.save_pretrained(str(output_dir))
    experiment = update_experiment(args.experiment_id, status="complete", stage="finetune", model={"baselineCheckpoint": args.checkpoint, "fineTunedCheckpoint": str(output_dir.relative_to(ROOT)), "epochs": args.epochs, "learningRate": args.learning_rate, "batchSize": args.batch_size, "seed": args.seed, "hardware": "cuda" if torch.cuda.is_available() else "cpu", "trainingSeconds": round(time.time() - started, 3)})
    print(json.dumps(experiment, indent=2))


def run_finetuned_evaluation(args: argparse.Namespace) -> None:
    try:
        rows = load_manifest(args.experiment_id, "test")
        output = EXPERIMENTS_DIR / f"{args.experiment_id}-finetuned-predictions.json"
        predictions = transcribe(args.checkpoint, rows, output)
        metrics = evaluate_predictions(predictions)
        baseline = read_json(EXPERIMENTS_DIR / f"{args.experiment_id}.json").get("baseline")
        if baseline and metrics.get("gap") is not None and baseline.get("gap") is not None:
            metrics["gapReduction"] = baseline["gap"] - metrics["gap"]
            metrics["gapReductionPercent"] = metrics["gapReduction"] / baseline["gap"] * 100 if baseline["gap"] else None
        update_experiment(args.experiment_id, status="complete", stage="evaluate", fineTuned=metrics)
    except Exception as error:
        update_experiment(args.experiment_id, status="failed", stage="evaluate", error=f"{type(error).__name__}: {error}")
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Reproducible Common Voice accent ASR experiment")
    subparsers = parser.add_subparsers(dest="command", required=True)
    prepare = subparsers.add_parser("prepare")
    prepare.add_argument("--experiment-id")
    prepare.add_argument("--seed", type=int, default=42)
    prepare.set_defaults(handler=prepare_dataset)
    baseline = subparsers.add_parser("baseline")
    baseline.add_argument("--experiment-id", required=True)
    baseline.add_argument("--checkpoint", default="openai/whisper-small")
    baseline.set_defaults(handler=run_baseline)
    finetune = subparsers.add_parser("finetune")
    finetune.add_argument("--experiment-id", required=True)
    finetune.add_argument("--checkpoint", default="openai/whisper-small")
    finetune.add_argument("--epochs", type=float, default=3)
    finetune.add_argument("--learning-rate", type=float, default=1e-5)
    finetune.add_argument("--batch-size", type=int, default=4)
    finetune.add_argument("--seed", type=int, default=42)
    finetune.set_defaults(handler=run_finetune)
    evaluate = subparsers.add_parser("evaluate")
    evaluate.add_argument("--experiment-id", required=True)
    evaluate.add_argument("--checkpoint", required=True)
    evaluate.set_defaults(handler=run_finetuned_evaluation)
    args = parser.parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
