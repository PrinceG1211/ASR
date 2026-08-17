# External Python ML worker

This service executes the existing MSc experiment with real Mozilla Common Voice data, Whisper inference, WER/CER, balanced accent fine-tuning, and same-test-set evaluation. It is separate from the React/Express Builder application because the Builder runtime does not include PyTorch or a Python package installer.

## Runtime

- Python 3.11
- PyTorch 2.4.1 with CUDA 12.1 runtime base image
- Transformers 4.46.3
- Datasets 3.1.0
- Evaluate, jiwer, Accelerate, librosa, soundfile, pandas, numpy
- FastAPI and Uvicorn

The worker detects CUDA, GPU name, and GPU memory at `/health`. If no GPU is present, health reports CPU execution. Fine-tuning may be impractical on CPU and is never reported complete unless a checkpoint is actually saved.

## Build and run

```bash
docker build -t accentlens-ml-worker worker
docker run --gpus all -p 8000:8000 \
  -e ML_WORKER_API_KEY=<secret> \
  -e ML_WORKER_MODEL=openai/whisper-small \
  -v accentlens-ml-data:/var/lib/ml-worker/data \
  accentlens-ml-worker
```

The `--gpus all` option is only for a CUDA-capable deployment. The image can report CPU availability when deployed without a GPU, but real fine-tuning requires appropriate compute and storage.

## Environment variables

```text
ML_WORKER_API_KEY=required-secret
ML_WORKER_MODEL=openai/whisper-small
ML_DATA_ROOT=/var/lib/ml-worker/data
HF_HOME=/var/lib/ml-worker/huggingface
COMMON_VOICE_DATASET=mozilla-foundation/common_voice_17_0
COMMON_VOICE_CONFIG=en
ML_EXPERIMENT_SEED=42
PORT=8000
```

Never commit a real key, model cache, Common Voice files, manifests, or checkpoints.

## API

`POST /health` is an unauthenticated runtime check. It imports the required modules and reports Python, PyTorch, CUDA/GPU, Whisper, dataset, evaluation, and fine-tuning capability. A worker is only healthy when all required modules are importable.

All other endpoints require:

```http
Authorization: Bearer <ML_WORKER_API_KEY>
Content-Type: application/json
```

Endpoints:

```text
POST /prepare
POST /baseline
POST /finetune
POST /evaluate
GET  /experiments/:id
```

The stage endpoints accept JSON containing `experimentId`, `model`, `checkpoint`, `epochs`, `learningRate`, `batchSize`, and `seed` where applicable. They return a persisted experiment state with `status: running`; the Builder server polls `GET /experiments/:id` until the real operation is complete or failed.

## Research workflow

`/prepare` loads Common Voice 17.0 English, inspects `accent` or `accents`, records actual group availability/counts/duration, and creates a deterministic SHA-256 speaker-level 80/10/10 manifest with seed 42. `/baseline` uses the held-out manifest and pretrained Whisper to persist real predictions and per-accent WER/CER. `/finetune` is rejected until baseline completion and balances available target groups. `/evaluate` uses the exact original test manifest and persists tuned metrics plus gap reduction.

Errors remain failed experiment states. No endpoint creates synthetic data, predictions, metrics, or checkpoints.

## Builder connection

Configure the existing Builder Admin Dashboard with this worker's HTTPS base endpoint, model name, and the same API key. The Builder Express backend sends the key server-side, never to React. The first sequence after a successful health check is prepare, then baseline; fine-tuning and evaluation remain manual later stages.
