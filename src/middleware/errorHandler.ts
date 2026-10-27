import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const requestId = res.locals?.requestId ?? "unknown";
  const internalMessage = error instanceof Error && error.message ? error.message : "An unexpected error occurred";

  let statusCode = typeof (error as { statusCode?: number })?.statusCode === "number"
    ? (error as { statusCode: number }).statusCode
    : 500;
  let errorCode = typeof (error as { errorCode?: string })?.errorCode === "string"
    ? (error as { errorCode: string }).errorCode
    : "INTERNAL_SERVER_ERROR";

  const multerCode = (error as { code?: string })?.code;

  if (multerCode === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    errorCode = "FILE_TOO_LARGE";
  } else if (
    internalMessage === "Only PDF files are allowed" ||
    (error as { errorCode?: string })?.errorCode === "INVALID_FILE_TYPE"
  ) {
    statusCode = 415;
    errorCode = "INVALID_FILE_TYPE";
  } else if (multerCode === "LIMIT_UNEXPECTED_FILE" || internalMessage === "Field name missing") {
    statusCode = 400;
    errorCode = "FILE_REQUIRED";
  }

  console.error(JSON.stringify({
    requestId,
    errorCode,
    statusCode,
    message: internalMessage
  }));

  // These interview chat errors are deliberately written as safe, actionable
  // messages by InterviewChatService. Preserve them so a 503 explains whether
  // the model account/key is the problem instead of showing a generic failure.
  const safeInterviewChatErrors = new Set([
    "LLM_NOT_CONFIGURED",
    "LLM_QUOTA_EXCEEDED",
    "LLM_AUTH_FAILED",
    "LLM_MODEL_UNAVAILABLE",
    "JOB_LOOKUP_UNAVAILABLE",
    "INTERVIEW_CHAT_FAILED",
    "INTERVIEW_CHAT_UPSTREAM_UNAVAILABLE",
    "EMPTY_INTERVIEW_ANSWER",
  ]);
  const safeInterviewErrors = new Set([
    "LLM_NOT_CONFIGURED",
    "LLM_QUOTA_EXCEEDED",
    "LLM_AUTH_FAILED",
    "LLM_MODEL_UNAVAILABLE",
    "INTERVIEW_LLM_FAILED",
    "INVALID_LLM_JSON",
  ]);
  const message = safeInterviewChatErrors.has(errorCode) || safeInterviewErrors.has(errorCode)
    ? internalMessage
    : statusCode >= 500
      ? "The request could not be completed"
      : internalMessage;

  res.status(statusCode).json({
    success: false,
    requestId,
    errorCode,
    message
  });
};
