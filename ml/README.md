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
