from dataclasses import dataclass
from pathlib import Path
import os


ROOT = Path(__file__).resolve().parent


@dataclass(frozen=True)
class Settings:
    api_key: str
    port: int
    data_root: Path
    model_cache: Path
    checkpoint: str
    dataset_name: str
    dataset_config: str
    seed: int

    @classmethod
    def from_env(cls) -> "Settings":
        data_root = Path(os.getenv("ML_DATA_ROOT", str(ROOT / "data"))).resolve()
        model_cache = Path(os.getenv("HF_HOME", str(data_root / "huggingface"))).resolve()
        return cls(
            api_key=os.getenv("ML_WORKER_API_KEY", ""),
            port=int(os.getenv("PORT", "8000")),
            data_root=data_root,
            model_cache=model_cache,
            checkpoint=os.getenv("ML_WORKER_MODEL", "openai/whisper-small"),
            dataset_name=os.getenv("COMMON_VOICE_DATASET", "mozilla-foundation/common_voice_17_0"),
            dataset_config=os.getenv("COMMON_VOICE_CONFIG", "en"),
            seed=int(os.getenv("ML_EXPERIMENT_SEED", "42")),
        )

    @property
    def experiments_dir(self) -> Path:
        return self.data_root / "experiments"

    @property
    def manifests_dir(self) -> Path:
        return self.data_root / "manifests"

    @property
    def audio_dir(self) -> Path:
        return self.data_root / "audio"

    @property
    def models_dir(self) -> Path:
        return self.data_root / "models"


settings = Settings.from_env()
for directory in (settings.data_root, settings.experiments_dir, settings.manifests_dir, settings.audio_dir, settings.models_dir, settings.model_cache):
    directory.mkdir(parents=True, exist_ok=True)

os.environ.setdefault("HF_HOME", str(settings.model_cache))
os.environ.setdefault("TRANSFORMERS_CACHE", str(settings.model_cache))
