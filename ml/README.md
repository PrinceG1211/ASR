# Common Voice Whisper experiment

The experiment runs through Python, not Node.js. Use Python 3.10 or 3.11 with a virtual environment.

## Setup

```bash
cd <project-root>
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r ml/requirements.txt
```

On Windows, activate with `.venv\\Scripts\\activate` instead. Install the PyTorch build appropriate for the available CPU or CUDA runtime before installing the remaining requirements when needed.

The server uses `PYTHON_BIN` when set; otherwise it invokes `python3`. For a virtual environment, start the server with the environment active or set `PYTHON_BIN` to the virtual-environment interpreter.

## Sanity check

Run this before downloading Common Voice:

```bash
python -c "import torch, transformers, datasets, evaluate, jiwer, librosa, soundfile, accelerate, pandas, numpy; print('ML imports OK', torch.__version__)"
python ml/pipeline.py --help
```

The first Whisper command downloads the configured checkpoint from Hugging Face and requires network access and enough disk space. A model-loading and audio transcription check should be completed before starting the full experiment.

## Research workflow

```bash
python ml/pipeline.py prepare --seed 42
python ml/pipeline.py baseline --experiment-id <experiment-id> --checkpoint openai/whisper-small
python ml/pipeline.py finetune --experiment-id <experiment-id> --checkpoint openai/whisper-small --epochs 3 --learning-rate 0.00001 --batch-size 4 --seed 42
python ml/pipeline.py evaluate --experiment-id <experiment-id> --checkpoint data/models/<experiment-id>
```

`prepare` downloads Mozilla Common Voice 17.0 English, uses the dataset's accent metadata, writes real audio and a speaker-level split manifest under `data/`, and persists dataset statistics in `data/experiments/<experiment-id>.json`. Missing target accent groups are reported rather than filled with synthetic data. Baseline and fine-tuned evaluation read the same test rows from that manifest.

The Express API starts these stages asynchronously. If Python, a package, the dataset, the model, or hardware fails, the experiment JSON is marked `failed` with the exception type and message; no experimental metric is generated.

## External worker contract

The Builder server can delegate execution to an authenticated HTTPS Python worker. Configure the provider, endpoint, model, and secret from the Admin Dashboard or with server-side environment variables:

```text
ML_WORKER_PROVIDER
ML_WORKER_ENDPOINT
ML_WORKER_MODEL
ML_WORKER_API_KEY
```

The worker must implement these JSON endpoints under the configured base endpoint:

```text
POST /health
POST /prepare
POST /baseline
POST /finetune
POST /evaluate
GET  /experiments/:id
```

Every stage response must include the experiment state, either directly or under an `experiment` property. The state must use the existing experiment JSON shape and must remain `running` until the real operation finishes. The Builder server polls `GET /experiments/:id` and persists the returned state. Worker requests use `Authorization: Bearer <server-side-secret>`; the secret is never returned to the client.

`/health` must only report success when the worker can load its configured Whisper/runtime dependencies. `/prepare` must run Common Voice preparation, `/baseline` must generate real held-out Whisper predictions and WER/CER, `/finetune` must create a real checkpoint after a completed baseline, and `/evaluate` must evaluate the same test manifest.
