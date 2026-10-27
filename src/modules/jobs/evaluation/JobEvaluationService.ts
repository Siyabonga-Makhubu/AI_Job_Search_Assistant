import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ObjectId } from "mongodb";
import { env } from "../../../config/env";
import { JobRepository } from "../ingestion/repositories/JobRepository";
import type { Job } from "../types/job.types";
import {
  EVALUATION_METRICS,
  type EvaluationCacheDocument,
  type EvaluationHistoryFilters,
  type EvaluationMetricName,
  type EvaluationMetricOutput,
  type EvaluationResultDocument,
  type EvaluationSettings,
} from "./evaluation.types";
import { JobEvaluationRepository } from "./JobEvaluationRepository";

type WorkerMetricResult = Omit<EvaluationMetricOutput, "timestamp"> & {
  timestamp: string;
};

type WorkerPayload = {
  query: string;
  inputQuery: string;
  judgeModel: string;
  alignmentThreshold: number;
  relevancyThreshold: number;
  faithfulnessThreshold: number;
  jobs: Job[];
  evaluateMetricsByJob: Record<string, EvaluationMetricName[]>;
};

export class JobEvaluationService {
  constructor(
    private readonly repository = new JobEvaluationRepository(),
    private readonly jobs = new JobRepository(),
  ) {}

  getSettings(): EvaluationSettings {
    const threshold = (value: number): number =>
      Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.7;
    const configuredMaxJobs = Number.isFinite(env.deepEvalMaxJobs) ? env.deepEvalMaxJobs : 10;
    return {
      enabled: env.deepEvalEnabled,
      judgeModel: env.deepEvalJudgeModel.trim() || env.groqModel,
      alignmentThreshold: threshold(env.deepEvalAlignmentThreshold),
      relevancyThreshold: threshold(env.deepEvalRelevancyThreshold),
      faithfulnessThreshold: threshold(env.deepEvalFaithfulnessThreshold),
      maxJobs: Math.max(1, Math.min(50, Math.floor(configuredMaxJobs))),
    };
  }

  async run(query: string, requestedJobIds: string[]): Promise<{
    runId: string;
    results: EvaluationResultDocument[];
  }> {
    const settings = this.getSettings();
    if (!settings.enabled) {
      throw Object.assign(new Error("DeepEval is disabled. Set DEEPEVAL_ENABLED=true to enable it."), {
        statusCode: 503,
        errorCode: "DEEPEVAL_DISABLED",
      });
    }
    if (!env.groqApiKey) {
      throw Object.assign(new Error("GROQ_API_KEY must be configured to run DeepEval."), {
        statusCode: 503,
        errorCode: "DEEPEVAL_JUDGE_NOT_CONFIGURED",
      });
    }

    if (typeof query !== "string") throw invalidInput("query must be 1 to 2000 characters");
    const normalizedQuery = query.trim();
    if (!normalizedQuery || normalizedQuery.length > 2000) {
      throw invalidInput("query must be 1 to 2000 characters");
    }
    if (!Array.isArray(requestedJobIds) || !requestedJobIds.length ||
      requestedJobIds.length > 50 ||
      !requestedJobIds.every((jobId) => typeof jobId === "string" && jobId.trim())) {
      throw invalidInput("jobIds must contain between 1 and 50 non-empty job IDs");
    }

    const jobIds = [...new Set(requestedJobIds)].slice(0, settings.maxJobs);
    const foundJobs = await this.jobs.findByJobIds(jobIds);
    const jobsById = new Map(foundJobs.map((job) => [job.jobId, job]));
    const retrievedJobs = jobIds.flatMap((jobId) => {
      const job = jobsById.get(jobId);
      return job ? [job] : [];
    });
    if (!retrievedJobs.length) {
      throw Object.assign(new Error("No stored jobs were found for this evaluation."), {
        statusCode: 404,
        errorCode: "EVALUATION_JOBS_NOT_FOUND",
      });
    }

    const runId = randomUUID();
    const cachedByKey = new Map<string, EvaluationCacheDocument>();
    const missingMetricsByJob: Record<string, EvaluationMetricName[]> = {};
    for (const job of retrievedJobs) {
      for (const metricName of EVALUATION_METRICS) {
        const key = cacheKey(normalizedQuery, job.jobId, settings.judgeModel, metricName);
        const cached = await this.repository.findCached(key);
        if (cached) {
          cachedByKey.set(key, cached);
        } else {
          (missingMetricsByJob[job.jobId] ??= []).push(metricName);
        }
      }
    }

    const workerResults = Object.keys(missingMetricsByJob).length
      ? await runPythonWorker({
          query: normalizedQuery,
          inputQuery: normalizedQuery,
          judgeModel: settings.judgeModel,
          alignmentThreshold: settings.alignmentThreshold,
          relevancyThreshold: settings.relevancyThreshold,
          faithfulnessThreshold: settings.faithfulnessThreshold,
          jobs: retrievedJobs,
          evaluateMetricsByJob: missingMetricsByJob,
        })
      : [];

    const workerByKey = new Map<string, WorkerMetricResult>();
    for (const result of workerResults) {
      const key = cacheKey(normalizedQuery, result.jobId, settings.judgeModel, result.metricName);
      workerByKey.set(key, result);
    }

    const timestamp = new Date();
    const output: EvaluationResultDocument[] = [];
    for (const job of retrievedJobs) {
      for (const metricName of EVALUATION_METRICS) {
        const key = cacheKey(normalizedQuery, job.jobId, settings.judgeModel, metricName);
        const cached = cachedByKey.get(key);
        const metric = workerByKey.get(key);
        if (cached || metric) {
          const result = resultDocument(cached ?? metric!, runId, timestamp, Boolean(cached));
          output.push(result);
          if (metric && !metric.error) await this.repository.saveCached(key, result);
        }
      }
    }

    await this.repository.insertResults(output);
    return { runId, results: output };
  }

  async list(filters: EvaluationHistoryFilters): Promise<Array<EvaluationResultDocument & { _id: ObjectId }>> {
    return this.repository.listResults(filters);
  }
}

function invalidInput(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400, errorCode: "INVALID_EVALUATION_INPUT" });
}

function cacheKey(
  query: string,
  jobId: string | null,
  model: string,
  metricName: string,
): string {
  const input = JSON.stringify(["job-evaluation-v2", query.trim().replace(/\s+/g, " ").toLowerCase(), jobId ?? "__query__", model, metricName]);
  return createHash("sha256").update(input).digest("hex");
}

function resultDocument(
  result: EvaluationCacheDocument | WorkerMetricResult,
  runId: string,
  timestamp: Date,
  cached: boolean,
): EvaluationResultDocument {
  return {
    query: result.query,
    jobId: result.jobId,
    jobTitle: result.jobTitle,
    company: result.company,
    metricName: result.metricName as EvaluationMetricName,
    score: result.score,
    threshold: result.threshold,
    passed: result.passed,
    reason: result.reason,
    ...(result.generatedAnswer ? { generatedAnswer: result.generatedAnswer } : {}),
    timestamp: cached
      ? timestamp
      : typeof result.timestamp === "string"
        ? new Date(result.timestamp)
        : timestamp,
    judgeModel: result.judgeModel,
    ...(result.error ? { error: result.error } : {}),
    runId,
    cached,
  };
}

function runPythonWorker(payload: WorkerPayload): Promise<WorkerMetricResult[]> {
  const script = path.resolve(__dirname, "../../../../evaluation/deepeval_job_eval.py");
  const windowsPython = path.resolve(process.cwd(), "venv", "Scripts", "python.exe");
  const python = process.env.DEEPEVAL_PYTHON ||
    (process.platform === "win32" && existsSync(windowsPython) ? windowsPython : "python3");
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(`Unable to start the DeepEval Python runner: ${error.message}`)));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`DeepEval runner exited with code ${code}: ${stderr.trim() || "No error details returned."}`));
        return;
      }
      try {
        const parsed: unknown = JSON.parse(stdout);
        if (!Array.isArray(parsed)) throw new Error("The DeepEval runner returned an invalid result list");
        resolve(parsed as WorkerMetricResult[]);
      } catch (error) {
        reject(new Error(`Unable to parse DeepEval runner output: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
