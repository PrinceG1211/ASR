import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { RequestHandler } from "express";

const projectRoot = path.resolve(process.cwd());
const experimentsDirectory = path.join(projectRoot, "data", "experiments");
const pythonCommand = process.env.PYTHON_BIN ?? "python3";

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
