from collections import defaultdict
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
from typing import Any

from config import settings
from experiment_store import update


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
    candidates = value if isinstance(value, list) else [value]
    aliases = {
        "american": ("american", "united states", "usa", "us"),
        "indian": ("indian", "india", "in"),
        "nigerian": ("nigerian", "nigeria", "ng"),
        "scottish": ("scottish", "scotland", "sco"),
    }
    for candidate in candidates:
        normalized = str(candidate or "").strip().lower()
        for group, values in aliases.items():
            if normalized in values or any(value in normalized for value in values if len(value) > 2):
                return group
    return None


def speaker_split(client_id: str, seed: int) -> str:
    digest = hashlib.sha256(f"{seed}:{client_id}".encode()).hexdigest()
    bucket = int(digest[:8], 16) % 100
    return "train" if bucket < 80 else "validation" if bucket < 90 else "test"


def prepare_dataset(experiment_id: str, seed: int) -> dict[str, Any]:
    from datasets import Audio, load_dataset
    import soundfile as sf

    dataset = load_dataset(settings.dataset_name, settings.dataset_config, split="train", trust_remote_code=True)
    if "audio" not in dataset.column_names or "client_id" not in dataset.column_names:
        raise RuntimeError("Common Voice dataset must expose audio and client_id columns.")
    accent_column = next((column for column in ("accent", "accents") if column in dataset.column_names), None)
    if accent_column is None:
        raise RuntimeError("Common Voice dataset must expose accent or accents metadata.")
    dataset = dataset.cast_column("audio", Audio(sampling_rate=None))
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
        audio_path = settings.audio_dir / f"{sample_id}.wav"
        if not audio_path.exists():
            sf.write(audio_path, array, sample_rate)
        rows.append(Sample(sample_id, client_id, group, sentence, str(audio_path.relative_to(settings.data_root)), len(array) / sample_rate, speaker_split(client_id, seed)))
    if not rows:
        raise RuntimeError("No valid Common Voice samples with the requested accent metadata were found.")

    manifest_path = settings.manifests_dir / f"{experiment_id}.jsonl"
    manifest_path.write_text("\n".join(json.dumps(asdict(row), ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
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
    available = {row["accent"] for row in accents if row["samples"] > 0}
    summary = {
        "dataset": "Mozilla Common Voice",
        "version": "17.0",
        "language": settings.dataset_config,
        "accents": accents,
        "speakers": len({row.client_id for row in rows}),
        "samples": len(rows),
        "durationSeconds": round(sum(row.duration_seconds for row in rows), 3),
        "trainSamples": sum(row.split == "train" for row in rows),
        "validationSamples": sum(row.split == "validation" for row in rows),
        "testSamples": sum(row.split == "test" for row in rows),
        "insufficientAccents": [group for group in TARGETS if group not in available],
        "splitSeed": seed,
        "splitStrategy": "sha256 speaker-level 80/10/10",
        "manifest": str(manifest_path.relative_to(settings.data_root)),
    }
    return update(experiment_id, status="complete", stage="dataset", dataset=summary)


def load_manifest(experiment_id: str, split: str | None = None) -> list[dict[str, Any]]:
    path = settings.manifests_dir / f"{experiment_id}.jsonl"
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found for experiment {experiment_id}.")
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return [row for row in rows if split is None or row["split"] == split]
