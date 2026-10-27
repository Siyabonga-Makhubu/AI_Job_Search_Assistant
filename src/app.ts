import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./middleware/logger";
import { requestId } from "./middleware/requestId";
import { checkDatabase } from "./config/database";
import { env } from "./config/env";
import ingestionRoutes from "./modules/ingestion/routes/ingestionRoutes";
import retrievalRoutes from "./modules/retrieval/routes/retrievalRoutes";
import jobEvaluationRoutes from "./modules/jobs/routes/jobEvaluationRoutes";
import jobRoutes from "./modules/jobs/routes/jobRoutes";
import interviewRoutes from "./modules/interview/routes/interviewRoutes";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(requestId);
app.use(logger);
app.use("/v1", ingestionRoutes);
app.use("/v1", retrievalRoutes);
app.use("/v1", jobEvaluationRoutes);
app.use("/v1", jobRoutes);
app.use("/v1", interviewRoutes);

app.get("/v1/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    app: "resume-rag-backend",
    version: "1.0.0",
    llmConfigured: env.llmConfigured,
    uptime: Number(process.uptime().toFixed(1))
  });
});

app.get("/v1/health/db", async (_req, res) => {
  try {
    const latencyMs = await checkDatabase();
    res.status(200).json({
      status: "ok",
      database: "mongodb",
      connected: true,
      latencyMs
    });
  } catch (error) {
    console.error(error);
    res.status(503).json({
      status: "error",
      database: "mongodb",
      connected: false,
      errorCode: "DB_CONNECTION_FAILED"
    });
  }
});

app.use(errorHandler);
