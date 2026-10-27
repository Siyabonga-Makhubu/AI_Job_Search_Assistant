import type { NextFunction, Request, Response } from "express";
import { EVALUATION_METRICS, type EvaluationMetricName } from "../evaluation/evaluation.types";
import { JobEvaluationService } from "../evaluation/JobEvaluationService";

const evaluationService = new JobEvaluationService();

function parseDate(value: unknown, field: string): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    throw invalidFilter(`${field} must be an ISO date`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw invalidFilter(`${field} must be a valid date`);
  return date;
}

function invalidFilter(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400, errorCode: "INVALID_EVALUATION_FILTER" });
}

export const jobEvaluationController = {
  config: (_req: Request, res: Response) => {
    res.status(200).json({ success: true, settings: evaluationService.getSettings() });
  },

  history: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metric = req.query.metric;
      if (metric !== undefined && (typeof metric !== "string" || !EVALUATION_METRICS.includes(metric as EvaluationMetricName))) {
        throw invalidFilter("metric must be a supported evaluation metric");
      }
      const passed = req.query.passed;
      if (passed !== undefined && passed !== "true" && passed !== "false") {
        throw invalidFilter("passed must be true or false");
      }
      const results = await evaluationService.list({
        ...(typeof req.query.query === "string" && req.query.query.trim()
          ? { query: req.query.query.trim().slice(0, 200) }
          : {}),
        ...(req.query.from ? { from: parseDate(req.query.from, "from") } : {}),
        ...(req.query.to ? { to: parseDate(req.query.to, "to") } : {}),
        ...(typeof metric === "string" ? { metricName: metric as EvaluationMetricName } : {}),
        ...(passed !== undefined ? { passed: passed === "true" } : {}),
      });
      res.status(200).json({
        success: true,
        settings: evaluationService.getSettings(),
        results: results.map(({ _id, ...result }) => ({
          ...result,
          id: _id.toString(),
          timestamp: result.timestamp.toISOString(),
        })),
      });
    } catch (error) { next(error); }
  },

  run: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await evaluationService.run(req.body?.query, req.body?.jobIds);
      res.status(200).json({
        success: true,
        runId: result.runId,
        results: result.results.map((item) => ({
          ...item,
          timestamp: item.timestamp.toISOString(),
        })),
      });
    } catch (error) { next(error); }
  },
};
