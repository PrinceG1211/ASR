from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import platform
import importlib.util
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, status

from api_models import HealthResponse, StageRequest
from auth import require_worker_key
from config import settings
from experiment_store import create, read, update
from pipeline import execute


executor = ThreadPoolExecutor(max_workers=1)


def capability_modules() -> dict[str, list[str]]:
    return {
        "whisper": ["torch", "transformers"],
        "dataset": ["datasets", "soundfile", "librosa"],
        "evaluation": ["jiwer", "evaluate"],
        "fineTuning": ["torch", "transformers", "datasets", "accelerate"],
    }


def health_payload() -> dict:
    required = sorted({module for modules in capability_modules().values() for module in modules} | {"numpy", "pandas"})
    missing = [module for module in required if importlib.util.find_spec(module) is None]
    torch_available = importlib.util.find_spec("torch") is not None
    torch_version = None
    cuda_available = False
    gpu_name = None
    gpu_memory = None
    if torch_available:
        import torch
        torch_version = torch.__version__
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory = torch.cuda.get_device_properties(0).total_memory
    capability = {name: not any(module in missing for module in modules) for name, modules in capability_modules().items()}
    healthy = not missing
    return {"status": "healthy" if healthy else "unhealthy", "pythonVersion": platform.python_version(), "torchVersion": torch_version, "cudaAvailable": cuda_available, "gpuName": gpu_name, "gpuMemoryBytes": gpu_memory, "whisperAvailable": capability["whisper"], "datasetAvailable": capability["dataset"], "evaluationAvailable": capability["evaluation"], "fineTuningAvailable": capability["fineTuning"], "missing": missing}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    executor.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="AccentLens External ML Worker", version="1.0.0", lifespan=lifespan)


@app.post("/health", response_model=HealthResponse)
def health() -> dict:
    return health_payload()


def submit(stage: str, request: StageRequest) -> dict:
    experiment_id = request.experimentId or str(uuid4())
    if request.experimentId:
        current = read(experiment_id)
        if current.get("status") == "running":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An experiment stage is already running.")
        update(experiment_id, status="running", stage=stage, error=None)
    else:
        create(experiment_id, stage)
    payload = request.model_dump(exclude_none=True)
    payload["model"] = request.model or settings.checkpoint
    executor.submit(execute, stage, experiment_id, payload)
    return read(experiment_id)


@app.post("/prepare", dependencies=[Depends(require_worker_key)])
def prepare(request: StageRequest) -> dict:
    return submit("prepare", request)


@app.post("/baseline", dependencies=[Depends(require_worker_key)])
def baseline(request: StageRequest) -> dict:
    experiment = read(request.experimentId or "")
    if not experiment.get("dataset"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Prepare the Common Voice dataset before running baseline.")
    return submit("baseline", request)


@app.post("/finetune", dependencies=[Depends(require_worker_key)])
def finetune(request: StageRequest) -> dict:
    experiment = read(request.experimentId or "")
    if not experiment.get("baseline"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A completed baseline is required before fine-tuning.")
    return submit("finetune", request)


@app.post("/evaluate", dependencies=[Depends(require_worker_key)])
def evaluate(request: StageRequest) -> dict:
    experiment = read(request.experimentId or "")
    if not (experiment.get("model") or {}).get("fineTunedCheckpoint"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A real fine-tuned checkpoint is required before evaluation.")
    checkpoint = request.checkpoint or str(settings.models_dir / request.experimentId)
    request = request.model_copy(update={"checkpoint": checkpoint})
    return submit("evaluate", request)


@app.get("/experiments/{experiment_id}", dependencies=[Depends(require_worker_key)])
def experiment(experiment_id: str) -> dict:
    return read(experiment_id)
