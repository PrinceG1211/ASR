import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { getExperiment, getInstallationStatus, getLatestExperiment, getRuntimeStatus, installRuntimeDependencies, listExperiments, prepareExperiment, runExperimentStage } from "./routes/experiments";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/experiments/runtime", getRuntimeStatus);
  app.get("/api/experiments/runtime/install", getInstallationStatus);
  app.post("/api/experiments/runtime/install", installRuntimeDependencies);
  app.get("/api/demo", handleDemo);
  app.get("/api/experiments", listExperiments);
  app.get("/api/experiments/latest", getLatestExperiment);
  app.get("/api/experiments/:id", getExperiment);
  app.post("/api/experiments", prepareExperiment);
  app.post("/api/experiments/:id/:stage", runExperimentStage);

  return app;
}
