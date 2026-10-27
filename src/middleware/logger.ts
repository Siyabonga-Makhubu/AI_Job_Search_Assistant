import type { RequestHandler } from "express";

export const logger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    console.log(JSON.stringify({
      requestId: res.locals?.requestId ?? "unknown",
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: res.statusCode,
      fileName: req.file?.originalname ?? undefined,
      durationMs: Date.now() - startedAt
    }));
  });

  next();
};
