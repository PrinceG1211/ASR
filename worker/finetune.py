from collections import defaultdict
from typing import Any
import time

from config import settings
from dataset import TARGETS, load_manifest
from experiment_store import update


def run_finetune(experiment_id: str, checkpoint: str, epochs: float, learning_rate: float, batch_size: int, seed: int) -> dict[str, Any]:
    import soundfile as sf
    import torch
    from datasets import Dataset
    from transformers import Seq2SeqTrainer, Seq2SeqTrainingArguments, WhisperForConditionalGeneration, WhisperProcessor

    experiment = __import__("experiment_store").read(experiment_id)
    if not experiment.get("baseline") or experiment.get("status") == "failed":
        raise RuntimeError("A completed baseline and held-out manifest are required before fine-tuning.")
    train_rows = load_manifest(experiment_id, "train")
    validation_rows = load_manifest(experiment_id, "validation")
    if not train_rows or not validation_rows:
        raise RuntimeError("Speaker-safe train and validation rows are required before fine-tuning.")
    counts = defaultdict(int)
    for row in train_rows:
        counts[row["accent"]] += 1
    missing = [group for group in TARGETS if counts[group] == 0]
    if missing:
        raise RuntimeError(f"Balanced fine-tuning requires all target groups in training data; missing: {', '.join(missing)}.")
    target_count = min(counts.values())
    balanced_rows = []
    for group in TARGETS:
        balanced_rows.extend([row for row in train_rows if row["accent"] == group][:target_count])

    processor = WhisperProcessor.from_pretrained(checkpoint, cache_dir=str(settings.model_cache))
    model = WhisperForConditionalGeneration.from_pretrained(checkpoint, cache_dir=str(settings.model_cache))
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    def encode(row: dict[str, Any]) -> dict[str, Any]:
        audio, sample_rate = sf.read(settings.data_root / row["audio_path"])
        return {"input_features": processor(audio, sampling_rate=sample_rate).input_features[0], "labels": processor.tokenizer(row["sentence"]).input_ids}

    train_dataset = Dataset.from_list([encode(row) for row in balanced_rows])
    validation_dataset = Dataset.from_list([encode(row) for row in validation_rows])

    class DataCollator:
        def __call__(self, features: list[dict[str, Any]]) -> dict[str, Any]:
            input_features = torch.tensor([feature["input_features"] for feature in features], dtype=torch.float32)
            labels = processor.tokenizer.pad([{"input_ids": feature["labels"]} for feature in features], return_tensors="pt").input_ids
            labels = labels.masked_fill(labels == processor.tokenizer.pad_token_id, -100)
            return {"input_features": input_features, "labels": labels}

    output_dir = settings.models_dir / experiment_id
    args = Seq2SeqTrainingArguments(output_dir=str(output_dir), per_device_train_batch_size=batch_size, per_device_eval_batch_size=batch_size, learning_rate=learning_rate, num_train_epochs=epochs, seed=seed, fp16=torch.cuda.is_available(), evaluation_strategy="epoch", save_strategy="epoch", logging_strategy="steps", logging_steps=10, predict_with_generate=True, report_to=[])
    trainer = Seq2SeqTrainer(model=model, args=args, train_dataset=train_dataset, eval_dataset=validation_dataset, data_collator=DataCollator(), tokenizer=processor.feature_extractor)
    started = time.time()
    trainer.train()
    trainer.save_model(str(output_dir))
    processor.save_pretrained(str(output_dir))
    checkpoint_path = str(output_dir.relative_to(settings.data_root))
    return update(experiment_id, status="complete", stage="finetune", model={"baselineCheckpoint": checkpoint, "fineTunedCheckpoint": checkpoint_path, "epochs": epochs, "learningRate": learning_rate, "batchSize": batch_size, "seed": seed, "hardware": "cuda" if torch.cuda.is_available() else "cpu", "trainingSeconds": round(time.time() - started, 3), "trainSamples": len(balanced_rows), "validationSamples": len(validation_rows), "testSamples": len(load_manifest(experiment_id, "test"))})
