import { Router } from "express";
import { jobEvaluationController } from "../controllers/jobEvaluationController";

const router = Router();

router.get("/jobs/evaluations/config", jobEvaluationController.config);
router.get("/jobs/evaluations", jobEvaluationController.history);
router.post("/jobs/evaluations/run", jobEvaluationController.run);

export default router;
