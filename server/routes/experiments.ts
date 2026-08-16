import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { RequestHandler } from "express";

const dependencyInstaller = `
import subprocess
import sys

requirements = sys.argv[1]
bootstrap = subprocess.run([sys.executable, "-m", "ensurepip", "--upgrade"], capture_output=True, text=True)
if bootstrap.returncode != 0:
    print(bootstrap.stdout)
    print(bootstrap.stderr, file=sys.stderr)
    raise SystemExit(bootstrap.returncode)
install = subprocess.run([sys.executable, "-m", "pip", "install", "-r", requirements], capture_output=True, text=True)
print(install.stdout)
print(install.stderr, file=sys.stderr)
raise SystemExit(install.returncode)
`;

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
let installationState: { status: "idle" | "running" | "complete" | "failed"; detail?: string } = { status: "idle" };

function readExperiment(id: string) {
  const filePath = path.join(experimentsDirectory, `${id}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readExperiments() {
  if (!existsSync(experimentsDirectory)) return [];
  return readdirSync(experimentsDirectory).filter((name) => name.endsWith(".json")).map((name) => JSON.parse(readFileSync(path.join(experimentsDirectory, name), "utf8"))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function runPipeline(args: string[], experimentId: string) {
  mkdirSync(experimentsDirectory, { recursive: true });
  const child = spawn(pythonCommand, [path.join(projectRoot, "ml", "pipeline.py"), ...args], { cwd: projectRoot, env: process.env, stdio: "ignore" });
  child.on("error", (error) => {
    const filePath = path.join(experimentsDirectory, `${experimentId}.json`);
    if (existsSync(filePath)) {
      const experiment = JSON.parse(readFileSync(filePath, "utf8"));
      experiment.status = "failed";
      experiment.error = `${error.name}: ${error.message}`;
      experiment.updatedAt = new Date().toISOString();
      writeFileSync(filePath, JSON.stringify(experiment, null, 2));
    }
  });
}

export const getRuntimeStatus: RequestHandler = async (_req, res) => {
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

export const installRuntimeDependencies: RequestHandler = (_req, res) => {
  if (installationState.status === "running") {
    res.status(202).json({ ...installationState });
    return;
  }
  installationState = { status: "running", detail: "Installing ML dependencies from ml/requirements.txt." };
  const child = spawn(pythonCommand, ["-c", dependencyInstaller, path.join(projectRoot, "ml", "requirements.txt")], { cwd: projectRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  child.on("error", (error) => {
    installationState = { status: "failed", detail: `${error.name}: ${error.message}` };
  });
  child.on("close", (code) => {
    if (code === 0) {
      installationState = { status: "complete", detail: "ML dependencies installed. Run the runtime check again." };
      return;
    }
    const detail = output.trim().split("\\n").slice(-8).join("\\n");
    installationState = { status: "failed", detail: detail || `pip exited with code ${code}.` };
  });
  res.status(202).json({ ...installationState });
};

export const getInstallationStatus: RequestHandler = (_req, res) => {
  res.json({ ...installationState });
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
  runPipeline(["prepare", "--experiment-id", experimentId], experimentId);
  res.status(202).json({ experimentId, status: "running", stage: "dataset" });
};

export const runExperimentStage: RequestHandler = (req, res) => {
  const experimentId = String(req.params.id);
  if (!readExperiment(experimentId)) return res.status(404).json({ error: "Experiment not found." });
  const stage = String(req.params.stage);
  if (!["baseline", "finetune", "evaluate"].includes(stage)) return res.status(400).json({ error: "Unsupported experiment stage." });
  const body = req.body as { checkpoint?: string; epochs?: number; learningRate?: number; batchSize?: number; seed?: number };
  const args = [stage, "--experiment-id", experimentId];
  if (body.checkpoint) args.push("--checkpoint", body.checkpoint);
  if (stage === "finetune") {
    args.push("--epochs", String(body.epochs ?? 3), "--learning-rate", String(body.learningRate ?? 0.00001), "--batch-size", String(body.batchSize ?? 4), "--seed", String(body.seed ?? 42));
  }
  if (stage === "evaluate" && !body.checkpoint) return res.status(400).json({ error: "A fine-tuned checkpoint is required for evaluation." });
  runPipeline(args, experimentId);
  res.status(202).json({ experimentId, status: "running", stage });
};
