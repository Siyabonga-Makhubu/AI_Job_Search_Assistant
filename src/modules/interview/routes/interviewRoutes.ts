import { Router } from "express";
import { interviewController } from "../controllers/interviewController";
const router = Router();
router.post("/interviews", interviewController.create);
router.post("/interviews/:sessionId/start", interviewController.start);
router.post("/interviews/:sessionId/answers", interviewController.answer);
router.post("/interviews/:sessionId/complete", interviewController.complete);
router.get("/interviews/:sessionId", interviewController.get);
export default router;
