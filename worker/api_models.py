from typing import Any

from pydantic import BaseModel, Field


class StageRequest(BaseModel):
    experimentId: str | None = None
    checkpoint: str | None = None
    model: str | None = None
    epochs: float = 3
    learningRate: float = 1e-5
    batchSize: int = 4
    seed: int = 42


class ExperimentState(BaseModel):
    id: str
    status: str
    stage: str | None = None
    error: str | None = None
    createdAt: str
    updatedAt: str
    dataset: dict[str, Any] | None = None
    model: dict[str, Any] | None = None
    baseline: dict[str, Any] | None = None
    fineTuned: dict[str, Any] | None = None


class HealthResponse(BaseModel):
    status: str
    pythonVersion: str
    torchVersion: str | None = None
    cudaAvailable: bool
    gpuName: str | None = None
    gpuMemoryBytes: int | None = None
    whisperAvailable: bool
    datasetAvailable: bool
    evaluationAvailable: bool
    fineTuningAvailable: bool
    missing: list[str] = Field(default_factory=list)
