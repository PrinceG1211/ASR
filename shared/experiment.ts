export type ExperimentStage = "dataset" | "split" | "baseline" | "finetune" | "evaluate";
export type ExperimentStatus = "idle" | "running" | "complete" | "failed";

export type AccentGroup = "american" | "indian" | "nigerian" | "scottish";

export type AccentStats = {
  accent: AccentGroup;
  label: string;
  speakers: number;
  samples: number;
  durationSeconds: number;
  trainSamples: number;
  validationSamples: number;
  testSamples: number;
  baselineWer?: number;
  baselineCer?: number;
  tunedWer?: number;
  tunedCer?: number;
};

export type DatasetSummary = {
  dataset: "Mozilla Common Voice";
  version: string;
  language: string;
  accents: AccentStats[];
  speakers: number;
  samples: number;
  durationSeconds: number;
  trainSamples: number;
  validationSamples: number;
  testSamples: number;
  insufficientAccents: AccentGroup[];
  generatedAt: string;
};

export type ExperimentSummary = {
  id: string;
  status: ExperimentStatus;
  stage?: ExperimentStage;
  error?: string;
  createdAt: string;
  updatedAt: string;
  dataset?: DatasetSummary;
  model?: {
    baselineCheckpoint: string;
    fineTunedCheckpoint?: string;
    epochs?: number;
    learningRate?: number;
    batchSize?: number;
    seed?: number;
    hardware?: string;
    trainingSeconds?: number;
  };
  baseline?: {
    accents: AccentStats[];
    meanWer: number;
    meanCer: number;
    bestWer: number;
    worstWer: number;
    gap: number;
  };
  fineTuned?: {
    accents: AccentStats[];
    meanWer: number;
    meanCer: number;
    bestWer: number;
    worstWer: number;
    gap: number;
    gapReduction: number;
    gapReductionPercent: number;
  };
};

export type ExperimentListResponse = {
  experiments: ExperimentSummary[];
};

export type ExperimentResponse = {
  experiment: ExperimentSummary | null;
};
