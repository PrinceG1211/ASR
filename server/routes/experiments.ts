import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { RequestHandler } from "express";

const runtimeProbe = `
import importlib.util
import json
import platform
import sys

required = {
    "torch": "PyTorch",
    "transformers": "Transformers",
    "datasets": "Datasets",
    "evaluate": "Evaluate",
    "jiwer": "jiwer",
    "librosa": "librosa",
    "soundfile": "soundfile",
    "accelerate": "Accelerate",
    "pandas": "pandas",
    "numpy": "numpy",
}
missing = [label for module, label in required.items() if importlib.util.find_spec(module) is None]
print(json.dumps({
    "pythonVersion": platform.python_version(),
    "missing": missing,
    "cuda": bool(importlib.util.find_spec("torch") and __import__("torch").cuda.is_available()),
}))
`;

function checkPythonRuntime(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const child = spawn(pythonCommand, ["-c", runtimeProbe], { cwd: projectRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ available: false, detail: "Python runtime check timed out." });
    }, 10000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ available: false, detail: `${error.name}: ${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ available: false, detail: stderr.trim() || `Python runtime exited with code ${code}.` });
        return;
      }
      try {
        const result = JSON.parse(stdout.trim()) as { pythonVersion: string; missing: string[]; cuda: boolean };
        resolve({ available: true, ...result });
      } catch {
        resolve({ available: false, detail: "Python runtime returned an unreadable diagnostic." });
      }
    });
  });
}

const projectRoot = path.resolve(process.cwd());
const experimentsDirectory = path.join(projectRoot, "data", "experiments");
const pythonCommand = process.env.PYTHON_BIN ?? "python3";
let workerConfig = {
  provider: process.env.ML_WORKER_PROVIDER ?? "",
  endpoint: process.env.ML_WORKER_ENDPOINT ?? "",
  model: process.env.ML_WORKER_MODEL ?? "openai/whisper-small",
  apiKey: process.env.ML_WORKER_API_KEY ?? "",
};
let workerConnection: { status: "unconfigured" | "testing" | "connected" | "failed"; detail: string; checkedAt?: string } = {
  status: workerConfig.endpoint && workerConfig.apiKey ? "failed" : "unconfigured",
  detail: workerConfig.endpoint && workerConfig.apiKey ? "Worker connection has not been tested." : "No external ML worker is configured.",
};

function readExperiment(id: string) {
  const filePath = path.join(experimentsDirectory, `${id}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readExperiments() {
  if (!existsSync(experimentsDirectory)) return [];
  return readdirSync(experimentsDirectory).filter((name) => name.endsWith(".json")).map((name) => JSON.parse(readFileSync(path.join(experimentsDirectory, name), "utf8"))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function publicWorkerConfig() {
  return { provider: workerConfig.provider, endpoint: workerConfig.endpoint, model: workerConfig.model, hasApiKey: Boolean(workerConfig.apiKey) };
}

function workerUrl(pathname: string) {
  if (!workerConfig.endpoint) throw new Error("External ML worker endpoint is not configured.");
  return `${workerConfig.endpoint.replace(/\/$/, "")}${pathname}`;
}

async function requestWorker(pathname: string, method: "GET" | "POST", body?: unknown) {
  const response = await fetch(workerUrl(pathname), {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${workerConfig.apiKey}` },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(method === "GET" ? 30000 : 120000),
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text || `Worker returned HTTP ${response.status}.` };
  }
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : `Worker returned HTTP ${response.status}.`;
    throw new Error(detail);
  }
  return payload as Record<string, unknown>;
}

async function testWorkerConnection() {
  if (!workerConfig.endpoint || !workerConfig.apiKey) {
    workerConnection = { status: "unconfigured", detail: "Set a worker endpoint and API key before testing." };
    return workerConnection;
  }
  workerConnection = { status: "testing", detail: "Testing authenticated external ML worker." };
  try {
    const health = await requestWorker("/health", "POST", { model: workerConfig.model });
    if (health.status !== "healthy") {
      const missing = Array.isArray(health.missing) ? ` Missing: ${(health.missing as unknown[]).join(", ")}.` : "";
      throw new Error(`External ML worker is unhealthy.${missing}`);
    }
    workerConnection = { status: "connected", detail: "Authenticated external ML worker responded healthy.", checkedAt: new Date().toISOString() };
  } catch (error) {
    workerConnection = { status: "failed", detail: error instanceof Error ? error.message : "External ML worker health check failed.", checkedAt: new Date().toISOString() };
  }
  return workerConnection;
}

function persistWorkerFailure(experimentId: string, stage: string, error: unknown) {
  const pathToExperiment = path.join(experimentsDirectory, `${experimentId}.json`);
  const experiment = readExperiment(experimentId);
  if (!experiment) return;
  experiment.status = "failed";
  experiment.stage = stage;
  experiment.error = error instanceof Error ? error.message : String(error);
  experiment.updatedAt = new Date().toISOString();
  writeFileSync(pathToExperiment, JSON.stringify(experiment, null, 2));
}

function persistWorkerPayload(experimentId: string, payload: Record<string, unknown>) {
  const current = readExperiment(experimentId) ?? { id: experimentId };
  const next = payload.experiment && typeof payload.experiment === "object" ? payload.experiment as Record<string, unknown> : payload;
  const merged = { ...current, ...next, id: experimentId, updatedAt: new Date().toISOString() };
  writeFileSync(path.join(experimentsDirectory, `${experimentId}.json`), JSON.stringify(merged, null, 2));
  return merged;
}

async function runWorkerStage(stage: "dataset" | "baseline" | "finetune" | "evaluate", experimentId: string, body: Record<string, unknown>) {
  try {
    if (workerConnection.status !== "connected") {
      const connection = await testWorkerConnection();
      if (connection.status !== "connected") throw new Error(connection.detail);
    }
    persistWorkerPayload(experimentId, { status: "running", stage });
    const initial = await requestWorker(`/${stage === "dataset" ? "prepare" : stage}`, "POST", { experimentId, model: workerConfig.model, ...body });
    const initialExperiment = persistWorkerPayload(experimentId, initial);
    if (initialExperiment.status !== "running") return;
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const current = await requestWorker(`/experiments/${experimentId}`, "GET");
      const updated = persistWorkerPayload(experimentId, current);
      if (updated.status !== "running") return;
    }
  } catch (error) {
    persistWorkerFailure(experimentId, stage, error);
  }
}

export const getWorkerConfig: RequestHandler = (_req, res) => {
  res.json({ config: publicWorkerConfig(), connection: workerConnection });
};

export const saveWorkerConfig: RequestHandler = (req, res) => {
  const body = req.body as { provider?: string; endpoint?: string; model?: string; apiKey?: string };
  const endpoint = String(body.endpoint ?? "").trim().replace(/\/$/, "");
  if (endpoint && !endpoint.startsWith("https://")) return res.status(400).json({ error: "The ML worker endpoint must use HTTPS." });
  workerConfig = {
    provider: String(body.provider ?? "").trim(),
    endpoint,
    model: String(body.model ?? "").trim() || "openai/whisper-small",
    apiKey: String(body.apiKey ?? "").trim() || workerConfig.apiKey,
  };
  workerConnection = { status: workerConfig.endpoint && workerConfig.apiKey ? "failed" : "unconfigured", detail: workerConfig.endpoint && workerConfig.apiKey ? "Worker configuration saved. Test the connection before running an experiment." : "Worker endpoint and API key are required." };
  res.json({ config: publicWorkerConfig(), connection: workerConnection });
};

export const testWorker: RequestHandler = async (_req, res) => {
  const connection = await testWorkerConnection();
  res.status(connection.status === "connected" ? 200 : 502).json({ config: publicWorkerConfig(), connection });
};

export const getRuntimeStatus: RequestHandler = async (_req, res) => {
  if (workerConnection.status === "connected") {
    const detail = workerConnection.detail;
    res.json({
      checkedAt: workerConnection.checkedAt ?? new Date().toISOString(),
      runtime: { status: "available", detail },
      whisper: { status: "available", detail: "External worker health check confirmed Whisper runtime availability." },
      dataset: { status: "available", detail: "External worker is ready to inspect Common Voice; dataset results are not loaded yet." },
      evaluation: { status: "available", detail: "External worker is ready to calculate WER/CER after inference." },
      fineTuning: { status: "available", detail: "External worker is ready for balanced fine-tuning after a completed baseline." },
    });
    return;
  }
  const result = await checkPythonRuntime();
  const missing = Array.isArray(result.missing) ? result.missing as string[] : [];
  const available = result.available === true;
  const dependencyDetail = missing.length ? `Missing Python packages: ${missing.join(", ")}.` : "Required Python packages are available.";
  res.json({
    checkedAt: new Date().toISOString(),
    runtime: { status: available ? "available" : "unavailable", detail: available ? `Python ${String(result.pythonVersion)} detected.` : String(result.detail ?? dependencyDetail) },
    whisper: { status: available && missing.length === 0 ? "available" : "unavailable", detail: available && missing.length === 0 ? "Whisper dependencies are available; model download is checked when a stage runs." : dependencyDetail },
    dataset: { status: available && missing.length === 0 ? "available" : "unavailable", detail: available && missing.length === 0 ? "Datasets dependencies are available; Common Voice access is checked when loading the dataset." : dependencyDetail },
    evaluation: { status: available && missing.length === 0 ? "available" : "unavailable", detail: available && missing.length === 0 ? "WER/CER dependencies are available." : dependencyDetail },
    fineTuning: { status: available && missing.length === 0 ? "available" : "unavailable", detail: available && missing.length === 0 ? `Training dependencies are available${result.cuda ? " with CUDA detected" : " on CPU"}.` : dependencyDetail },
  });
};

export const listExperiments: RequestHandler = (_req, res) => {
  res.json({ experiments: readExperiments() });
};

export const getLatestExperiment: RequestHandler = (_req, res) => {
  res.json({ experiment: readExperiments()[0] ?? null });
};

export const getExperiment: RequestHandler = (req, res) => {
  const experiment = readExperiment(String(req.params.id));
  if (!experiment) return res.status(404).json({ error: "Experiment not found." });
  res.json({ experiment });
};

export const prepareExperiment: RequestHandler = (_req, res) => {
  const experimentId = randomUUID();
  mkdirSync(experimentsDirectory, { recursive: true });
  const now = new Date().toISOString();
  writeFileSync(path.join(experimentsDirectory, `${experimentId}.json`), JSON.stringify({ id: experimentId, status: "running", stage: "dataset", createdAt: now, updatedAt: now }, null, 2));
  void runWorkerStage("dataset", experimentId, {});
  res.status(202).json({ experimentId, status: "running", stage: "dataset" });
};

export const runExperimentStage: RequestHandler = (req, res) => {
  const experimentId = String(req.params.id);
  const experiment = readExperiment(experimentId);
  if (!experiment) return res.status(404).json({ error: "Experiment not found." });
  const stage = String(req.params.stage) as "baseline" | "finetune" | "evaluate";
  if (!["baseline", "finetune", "evaluate"].includes(stage)) return res.status(400).json({ error: "Unsupported experiment stage." });
  if (experiment.status === "running") return res.status(409).json({ error: "Another experiment stage is already running." });
  if (stage === "baseline" && !experiment.dataset) return res.status(409).json({ error: "Prepare the Common Voice dataset before running the baseline." });
  if (stage === "finetune" && !experiment.baseline) return res.status(409).json({ error: "A completed baseline is required before fine-tuning." });
  if (stage === "evaluate" && !experiment.model?.fineTunedCheckpoint) return res.status(409).json({ error: "A completed fine-tuned checkpoint is required before evaluation." });
  const body = req.body as Record<string, unknown>;
  void runWorkerStage(stage, experimentId, body);
  res.status(202).json({ experimentId, status: "running", stage });
};
