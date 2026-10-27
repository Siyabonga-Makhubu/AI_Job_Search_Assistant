import { Router } from "express";
import { jobController } from "../controllers/jobController";

const router = Router();

router.get("/jobs/health", jobController.health);
router.get("/jobs/config", jobController.config);
router.get("/jobs/overview", jobController.overview);
router.get("/jobs/saved", jobController.getSavedJobs);
router.get("/jobs/:jobId/tailored-cv", jobController.getTailoredCv);
router.post("/jobs/:jobId/tailored-cv", jobController.generateTailoredCv);
router.put("/jobs/:jobId/tailored-cv", jobController.saveTailoredCv);
router.post("/jobs/:jobId/save", jobController.saveJob);
router.patch("/jobs/:jobId/status", jobController.updateStatus);
router.patch("/jobs/:jobId/application", jobController.updateApplication);

router.post("/jobs/discover", jobController.discover);
router.post("/jobs/ingest", jobController.ingest);
router.post("/jobs/search", jobController.search);

router.post("/jobs/:jobId/match", jobController.match);
router.post("/jobs/:jobId/application-message", jobController.applicationMessage);
router.post("/jobs/:jobId/interview-chat", jobController.interviewChat);
router.post("/jobs/:jobId/analyse", jobController.analyse);

router.get("/jobs/:jobId", jobController.getJob);

export default router;
