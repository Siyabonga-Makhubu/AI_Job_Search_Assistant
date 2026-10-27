import { Router } from "express";
import { retrievalController } from "../controllers/retrievalController";

const router = Router();

router.get("/retrieval/health", retrievalController.health);
router.get("/retrieval/readiness", retrievalController.readiness);
router.get("/resume/library", retrievalController.listResumes);
router.get("/resume/stats", retrievalController.stats);
router.get("/resume/duplicates/preview", retrievalController.previewDuplicates);
router.post("/resume/duplicates/delete", retrievalController.deleteDuplicates);
router.get("/resume/:resumeId", retrievalController.getResume);
router.post("/resume/search/raw", retrievalController.searchRaw);
router.post("/resume/search", retrievalController.search);

export default router;
