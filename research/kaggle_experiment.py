"""Self-contained Kaggle GPU experiment for the MSc accent disparity study.

This script intentionally performs no synthetic fallback. A failed stage is persisted
as FAILED/NOT EXECUTED and later metrics are not generated.
"""

from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import os
import platform
import subprocess
import sys
import time
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


OUTPUT = Path("/kaggle/working/asr_results")
OUTPUT.mkdir(parents=True, exist_ok=True)
SEED = 42
DATASET_NAME = "mozilla-foundation/common_voice_17_0"
DATASET_CONFIG = "en"
MODEL_CHECKPOINT = "openai/whisper-small"
EPOCHS = 1
LEARNING_RATE = 1e-5
BATCH_SIZE = 4
TARGETS = {
    "american": "American English",
    "indian": "Indian English",
    "nigerian": "Nigerian English",
    "scottish": "Scottish English",
}


class StageFailure(RuntimeError):
    pass


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_json(name: str, value: Any) -> None:
    (OUTPUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")


def read_json(name: str) -> Any:
    return json.loads((OUTPUT / name).read_text(encoding="utf-8"))


def update_experiment(**updates: Any) -> dict[str, Any]:
    path = OUTPUT / "experiment.json"
    experiment = read_json("experiment.json") if path.exists() else {}
    experiment.update(updates)
    experiment["updatedAt"] = timestamp()
    write_json("experiment.json", experiment)
    return experiment


def fail_stage(stage: str, error: BaseException) -> None:
    detail = f"{type(error).__name__}: {error}"
    update_experiment(status="failed", stage=stage, error=detail)
    write_final_report()
    print(f"FAILED [{stage}] {detail}")


def install_missing_packages() -> None:
    packages = {
        "torch": "torch==2.4.1",
        "transformers": "transformers==4.46.3",
        "datasets": "datasets==3.1.0",
        "evaluate": "evaluate==0.4.3",
        "jiwer": "jiwer==3.0.5",
        "accelerate": "accelerate==1.1.1",
        "librosa": "librosa==0.10.2.post1",
        "soundfile": "soundfile==0.12.1",
        "pandas": "pandas==2.2.3",
        "numpy": "numpy==1.26.4",
    }
    missing = [spec for module, spec in packages.items() if importlib.util.find_spec(module) is None]
    if missing:
        print("Installing missing packages:", ", ".join(missing))
        subprocess.check_call([sys.executable, "-m", "pip", "install", *missing])


def verify_gpu() -> dict[str, Any]:
    import torch

    if not torch.cuda.is_available():
        raise StageFailure("A Kaggle GPU is required; torch.cuda.is_available() returned False.")
    device = torch.device("cuda")
    properties = torch.cuda.get_device_properties(device)
    return {
        "device": str(device),
        "cudaAvailable": True,
        "gpuName": torch.cuda.get_device_name(device),
        "gpuMemoryBytes": properties.total_memory,
        "pythonVersion": platform.python_version(),
        "torchVersion": torch.__version__,
    }


def print_configuration(hardware: dict[str, Any], groups: list[str] | None = None, counts: dict[str, int] | None = None) -> None:
    print("\nEXPERIMENT CONFIGURATION")
    values = {
        "Dataset": DATASET_NAME,
        "Dataset version/configuration": f"17.0 / {DATASET_CONFIG}",
        "Model": MODEL_CHECKPOINT,
        "Seed": SEED,
        "Split": "sha256 speaker-level 80/10/10",
        "Accent groups": groups or list(TARGETS),
        "Train samples": (counts or {}).get("train", "not prepared"),
        "Validation samples": (counts or {}).get("validation", "not prepared"),
        "Test samples": (counts or {}).get("test", "not prepared"),
        "Epochs": EPOCHS,
        "Learning rate": LEARNING_RATE,
        "Batch size": BATCH_SIZE,
        "Hardware": hardware,
        "Python": platform.python_version(),
    }
    for module_name in ("torch", "transformers", "datasets", "evaluate", "jiwer", "accelerate", "librosa", "soundfile", "pandas", "numpy"):
        try:
            module = __import__(module_name)
            values[module_name] = getattr(module, "__version__", "installed")
        except Exception:
            values[module_name] = "unavailable"
    for key, value in values.items():
        print(f"{key}: {value}")


def accent_group(value: Any) -> str | None:
    candidates = value if isinstance(value, list) else [value]
    aliases = {
        "american": ("american", "united states", "usa", "us"),
        "indian": ("indian", "india", "in"),
        "nigerian": ("nigerian", "nigeria", "ng"),
        "scottish": ("scottish", "scotland", "sco"),
    }
    for candidate in candidates:
        normalized = str(candidate or "").strip().lower()
        for group, aliases_for_group in aliases.items():
            if normalized in aliases_for_group or any(alias in normalized for alias in aliases_for_group if len(alias) > 2):
                return group
    return None


def speaker_split(client_id: str) -> str:
    digest = hashlib.sha256(f"{SEED}:{client_id}".encode()).hexdigest()
    bucket = int(digest[:8], 16) % 100
    return "train" if bucket < 80 else "validation" if bucket < 90 else "test"


@dataclass
class Sample:
    sample_id: str
    client_id: str
    accent: str
    sentence: str
    audio_path: str
    duration_seconds: float
    split: str


def prepare_dataset() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    from datasets import Audio, load_dataset
    import soundfile as sf

    dataset = load_dataset(DATASET_NAME, DATASET_CONFIG, split="train", trust_remote_code=True)
    if "audio" not in dataset.column_names or "client_id" not in dataset.column_names:
        raise StageFailure("Common Voice must expose audio and client_id columns.")
    accent_column = next((column for column in ("accent", "accents") if column in dataset.column_names), None)
    if accent_column is None:
        raise StageFailure("Common Voice must expose accent or accents metadata.")
    dataset = dataset.cast_column("audio", Audio(sampling_rate=None))
    audio_root = OUTPUT / "audio"
    audio_root.mkdir(exist_ok=True)
    rows: list[Sample] = []
    for index, item in enumerate(dataset):
        group = accent_group(item.get(accent_column))
        sentence = str(item.get("sentence") or "").strip()
        client_id = str(item.get("client_id") or "").strip()
        audio = item.get("audio") or {}
        array = audio.get("array")
        sample_rate = int(audio.get("sampling_rate") or 0)
        if not group or not sentence or not client_id or array is None or sample_rate <= 0:
            continue
        sample_id = f"{group}-{index}"
        audio_path = audio_root / f"{sample_id}.wav"
        if not audio_path.exists():
            sf.write(audio_path, array, sample_rate)
        rows.append(Sample(sample_id, client_id, group, sentence, str(audio_path), len(array) / sample_rate, speaker_split(client_id)))
    if not rows:
        raise StageFailure("No valid Common Voice samples with the requested accent metadata were found.")

    manifest = [asdict(row) for row in rows]
    write_json("split_manifest.json", {"seed": SEED, "strategy": "sha256 speaker-level 80/10/10", "rows": manifest})
    stats: dict[str, dict[str, Any]] = defaultdict(lambda: {"speakers": set(), "samples": 0, "durationSeconds": 0.0, "trainSamples": 0, "validationSamples": 0, "testSamples": 0, "splitSpeakers": {"train": set(), "validation": set(), "test": set()}})
    for row in rows:
        entry = stats[row.accent]
        entry["speakers"].add(row.client_id)
        entry["splitSpeakers"][row.split].add(row.client_id)
        entry["samples"] += 1
        entry["durationSeconds"] += row.duration_seconds
        entry[f"{row.split}Samples"] += 1
    accents = []
    for group, label in TARGETS.items():
        entry = stats[group]
        accents.append({"accent": group, "label": label, "speakers": len(entry["speakers"]), "samples": entry["samples"], "durationSeconds": round(entry["durationSeconds"], 3), "trainSamples": entry["trainSamples"], "validationSamples": entry["validationSamples"], "testSamples": entry["testSamples"], "splitSpeakers": {split: len(entry["splitSpeakers"][split]) for split in ("train", "validation", "test")}})
    available = [row["accent"] for row in accents if row["samples"] > 0]
    train_speakers = {row.client_id for row in rows if row.split == "train"}
    validation_speakers = {row.client_id for row in rows if row.split == "validation"}
    test_speakers = {row.client_id for row in rows if row.split == "test"}
    if train_speakers & test_speakers or validation_speakers & test_speakers:
        raise StageFailure("Speaker leakage detected in deterministic split.")
    summary = {"dataset": "Mozilla Common Voice", "version": "17.0", "language": DATASET_CONFIG, "accents": accents, "availableAccents": available, "insufficientAccents": [group for group in TARGETS if group not in available], "speakers": len({row.client_id for row in rows}), "samples": len(rows), "durationSeconds": round(sum(row.duration_seconds for row in rows), 3), "trainSamples": sum(row.split == "train" for row in rows), "validationSamples": sum(row.split == "validation" for row in rows), "testSamples": sum(row.split == "test" for row in rows), "splitSeed": SEED, "splitStrategy": "sha256 speaker-level 80/10/10", "trainSpeakers": len(train_speakers), "validationSpeakers": len(validation_speakers), "testSpeakers": len(test_speakers)}
    write_json("dataset_statistics.json", summary)
    counts = {"train": summary["trainSamples"], "validation": summary["validationSamples"], "test": summary["testSamples"]}
    return manifest, {"summary": summary, "counts": counts, "speakers": {"train": train_speakers, "validation": validation_speakers, "test": test_speakers}}


def load_manifest(split: str | None = None) -> list[dict[str, Any]]:
    rows = read_json("split_manifest.json")["rows"]
    return [row for row in rows if split is None or row["split"] == split]


def run_inference(checkpoint: str, rows: list[dict[str, Any]], output_name: str) -> list[dict[str, Any]]:
    import torch
    import soundfile as sf
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    processor = WhisperProcessor.from_pretrained(checkpoint, cache_dir="/kaggle/working/huggingface")
    model = WhisperForConditionalGeneration.from_pretrained(checkpoint, cache_dir="/kaggle/working/huggingface").to("cuda")
    model.eval()
    predictions = []
    for row in rows:
        audio, sample_rate = sf.read(row["audio_path"])
        inputs = processor(audio, sampling_rate=sample_rate, return_tensors="pt")
        with torch.no_grad():
            token_ids = model.generate(inputs.input_features.to("cuda"))
        prediction = processor.batch_decode(token_ids, skip_special_tokens=True)[0].strip()
        predictions.append({"sampleId": row["sample_id"], "speakerId": row["client_id"], "accent": row["accent"], "audio": row["audio_path"], "reference": row["sentence"], "prediction": prediction})
    write_json(output_name, predictions)
    return predictions


def score_predictions(predictions: list[dict[str, Any]], prefix: str) -> dict[str, Any]:
    from jiwer import cer, wer

    by_accent: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in predictions:
        row[f"{prefix}Wer"] = wer(row["reference"], row["prediction"])
        row[f"{prefix}Cer"] = cer(row["reference"], row["prediction"])
        by_accent[row["accent"]].append(row)
    accents = []
    wer_key, cer_key = f"{prefix}Wer", f"{prefix}Cer"
    for group, label in TARGETS.items():
        rows = by_accent.get(group, [])
        if not rows:
            accents.append({"accent": group, "label": label, "samples": 0, "speakers": 0, wer_key: None, cer_key: None})
            continue
        accents.append({"accent": group, "label": label, "samples": len(rows), "speakers": len({row["speakerId"] for row in rows}), wer_key: wer([row["reference"] for row in rows], [row["prediction"] for row in rows]), cer_key: cer([row["reference"] for row in rows], [row["prediction"] for row in rows])})
    valid = [row for row in accents if row[wer_key] is not None]
    wers = [row[wer_key] for row in valid]
    return {"accents": accents, "meanWer": sum(wers) / len(wers) if wers else None, "meanCer": sum(row[cer_key] for row in valid) / len(valid) if valid else None, "bestWer": min(wers) if wers else None, "worstWer": max(wers) if wers else None, "gap": max(wers) - min(wers) if wers else None}


def run_finetuning(manifest: list[dict[str, Any]], hardware: dict[str, Any]) -> dict[str, Any]:
    import soundfile as sf
    import torch
    from datasets import Dataset
    from transformers import Seq2SeqTrainer, Seq2SeqTrainingArguments, WhisperForConditionalGeneration, WhisperProcessor

    experiment = read_json("experiment.json")
    if not experiment.get("baseline"):
        raise StageFailure("Fine-tuning requires a completed baseline.")
    train_rows = [row for row in manifest if row["split"] == "train"]
    validation_rows = [row for row in manifest if row["split"] == "validation"]
    counts = {group: sum(row["accent"] == group for row in train_rows) for group in TARGETS}
    missing = [group for group, count in counts.items() if count == 0]
    if missing:
        raise StageFailure(f"Balanced fine-tuning requires all selected groups; missing: {', '.join(missing)}")
    target_count = min(counts.values())
    balanced_rows = []
    for group in TARGETS:
        balanced_rows.extend([row for row in train_rows if row["accent"] == group][:target_count])
    processor = WhisperProcessor.from_pretrained(MODEL_CHECKPOINT, cache_dir="/kaggle/working/huggingface")
    model = WhisperForConditionalGeneration.from_pretrained(MODEL_CHECKPOINT, cache_dir="/kaggle/working/huggingface")
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    def encode(row: dict[str, Any]) -> dict[str, Any]:
        audio, sample_rate = sf.read(row["audio_path"])
        return {"input_features": processor(audio, sampling_rate=sample_rate).input_features[0], "labels": processor.tokenizer(row["sentence"]).input_ids}

    train_dataset = Dataset.from_list([encode(row) for row in balanced_rows])
    validation_dataset = Dataset.from_list([encode(row) for row in validation_rows])

    class Collator:
        def __call__(self, features: list[dict[str, Any]]) -> dict[str, Any]:
            input_features = torch.tensor([feature["input_features"] for feature in features], dtype=torch.float32)
            labels = processor.tokenizer.pad([{"input_ids": feature["labels"]} for feature in features], return_tensors="pt").input_ids
            labels = labels.masked_fill(labels == processor.tokenizer.pad_token_id, -100)
            return {"input_features": input_features, "labels": labels}

    output_dir = OUTPUT / "fine_tuned_model"
    args = Seq2SeqTrainingArguments(output_dir=str(output_dir), per_device_train_batch_size=BATCH_SIZE, per_device_eval_batch_size=BATCH_SIZE, learning_rate=LEARNING_RATE, num_train_epochs=EPOCHS, seed=SEED, fp16=True, evaluation_strategy="epoch", save_strategy="epoch", logging_strategy="steps", logging_steps=10, predict_with_generate=True, report_to=[])
    trainer = Seq2SeqTrainer(model=model, args=args, train_dataset=train_dataset, eval_dataset=validation_dataset, data_collator=Collator(), tokenizer=processor.feature_extractor)
    started = time.time()
    trainer.train()
    trainer.save_model(str(output_dir))
    processor.save_pretrained(str(output_dir))
    if not (output_dir / "config.json").exists():
        raise StageFailure("Fine-tuning returned without a saved checkpoint.")
    return {"checkpoint": str(output_dir), "epochs": EPOCHS, "learningRate": LEARNING_RATE, "batchSize": BATCH_SIZE, "seed": SEED, "trainSamples": len(balanced_rows), "validationSamples": len(validation_rows), "testSamples": len([row for row in manifest if row["split"] == "test"]), "hardware": hardware, "trainingSeconds": round(time.time() - started, 3), "balancedSamplesPerAccent": target_count}


def print_results_table(baseline: dict[str, Any], tuned: dict[str, Any] | None) -> None:
    tuned_rows = {row["accent"]: row for row in (tuned or {}).get("accents", [])}
    print("\nAccent | Speakers | Test Samples | Baseline WER | Baseline CER | Tuned WER | Tuned CER | Improvement")
    for row in baseline["accents"]:
        tuned_row = tuned_rows.get(row["accent"], {})
        improvement = None if row.get("baselineWer") is None or tuned_row.get("tunedWer") is None else row["baselineWer"] - tuned_row["tunedWer"]
        print(f"{row['label']} | {row['speakers']} | {row['samples']} | {row.get('baselineWer')} | {row.get('baselineCer')} | {tuned_row.get('tunedWer')} | {tuned_row.get('tunedCer')} | {improvement}")


def write_summary_csv(baseline: dict[str, Any], tuned: dict[str, Any] | None) -> None:
    tuned_rows = {row["accent"]: row for row in (tuned or {}).get("accents", [])}
    with (OUTPUT / "experiment_summary.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Accent", "Speakers", "Test Samples", "Baseline WER", "Baseline CER", "Tuned WER", "Tuned CER", "Improvement"])
        for row in baseline["accents"]:
            tuned_row = tuned_rows.get(row["accent"], {})
            improvement = None if row.get("baselineWer") is None or tuned_row.get("tunedWer") is None else row["baselineWer"] - tuned_row["tunedWer"]
            writer.writerow([row["label"], row["speakers"], row["samples"], row.get("baselineWer"), row.get("baselineCer"), tuned_row.get("tunedWer"), tuned_row.get("tunedCer"), improvement])


def write_final_report() -> None:
    experiment = read_json("experiment.json") if (OUTPUT / "experiment.json").exists() else {}
    lines = ["# FINAL RESULTS", "", f"Status: {experiment.get('status', 'NOT EXECUTED')}", f"Stage: {experiment.get('stage', 'not started')}", ""]
    if experiment.get("error"):
        lines += [f"Failure: {experiment['error']}", ""]
    lines += ["## Academic integrity", "Only values produced by real dataset loading, Whisper inference, and training are written. Failed or incomplete stages do not receive metrics.", ""]
    for key in ("dataset", "hardware", "baseline", "fineTunedConfig", "fineTuned", "gapAnalysis"):
        if experiment.get(key) is not None:
            lines += [f"## {key}", "```json", json.dumps(experiment[key], indent=2, ensure_ascii=False), "```", ""]
    lines += ["## Limitations", "The experiment must be run in a Kaggle GPU runtime. This repository script has not executed the dataset download, Whisper inference, or fine-tuning in the Builder environment."]
    (OUTPUT / "FINAL_RESULTS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    started = timestamp()
    update_experiment(id="kaggle-asr-accent-experiment", status="running", stage="environment", createdAt=started, config={"dataset": DATASET_NAME, "datasetVersion": "17.0", "datasetConfig": DATASET_CONFIG, "model": MODEL_CHECKPOINT, "seed": SEED, "split": "sha256 speaker-level 80/10/10", "epochs": EPOCHS, "learningRate": LEARNING_RATE, "batchSize": BATCH_SIZE})
    try:
        install_missing_packages()
        hardware = verify_gpu()
        update_experiment(stage="prepare", hardware=hardware)
        print_configuration(hardware)
        manifest, dataset_info = prepare_dataset()
        update_experiment(status="complete", stage="prepare", dataset=dataset_info["summary"])
        print_configuration(hardware, dataset_info["summary"]["availableAccents"], dataset_info["counts"])
        baseline_predictions = run_inference(MODEL_CHECKPOINT, [row for row in manifest if row["split"] == "test"], "baseline_predictions.json")
        baseline = score_predictions(baseline_predictions, "baseline")
        write_json("baseline_predictions.json", baseline_predictions)
        write_json("baseline_results.json", baseline)
        update_experiment(status="complete", stage="baseline", baseline=baseline)
        write_summary_csv(baseline, None)
        write_final_report()
        print("BASELINE COMPLETE. Results persisted; proceeding to the configured balanced fine-tuning stage.")
        print(json.dumps(baseline, indent=2))
        update_experiment(status="running", stage="finetune")
        fine_tuned = run_finetuning(manifest, hardware)
        update_experiment(status="complete", stage="finetune", fineTunedConfig=fine_tuned)
        update_experiment(status="running", stage="evaluate")
        tuned_predictions = run_inference(fine_tuned["checkpoint"], [row for row in manifest if row["split"] == "test"], "finetuned_predictions.json")
        tuned = score_predictions(tuned_predictions, "tuned")
        write_json("finetuned_predictions.json", tuned_predictions)
        baseline_gap = baseline.get("gap")
        tuned_gap = tuned.get("gap")
        gap_analysis = {"baselineGap": baseline_gap, "tunedGap": tuned_gap, "gapReduction": baseline_gap - tuned_gap if baseline_gap is not None and tuned_gap is not None else None, "gapReductionPercent": ((baseline_gap - tuned_gap) / baseline_gap * 100) if baseline_gap and tuned_gap is not None else None, "interpretation": "accent performance disparity"}
        tuned["gapReduction"] = gap_analysis["gapReduction"]
        tuned["gapReductionPercent"] = gap_analysis["gapReductionPercent"]
        write_json("finetuned_results.json", tuned)
        write_json("gap_analysis.json", gap_analysis)
        update_experiment(status="complete", stage="evaluate", fineTuned=tuned, gapAnalysis=gap_analysis)
        write_summary_csv(baseline, tuned)
        write_final_report()
        print_results_table(baseline, tuned)
        print("EXPERIMENT COMPLETE WITH REAL RESULTS")
    except Exception as error:
        stage = read_json("experiment.json").get("stage", "environment") if (OUTPUT / "experiment.json").exists() else "environment"
        fail_stage(stage, error)
        raise
    finally:
        final_experiment = read_json("experiment.json") if (OUTPUT / "experiment.json").exists() else {}
        final_dataset = read_json("dataset_statistics.json") if (OUTPUT / "dataset_statistics.json").exists() else {}
        print_configuration(final_experiment.get("hardware", {}), final_dataset.get("availableAccents"), {"train": final_dataset.get("trainSamples", "not prepared"), "validation": final_dataset.get("validationSamples", "not prepared"), "test": final_dataset.get("testSamples", "not prepared")})


if __name__ == "__main__":
    main()
