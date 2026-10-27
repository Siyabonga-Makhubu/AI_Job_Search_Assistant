import { Router } from "express";
import { ingestionController } from "../controllers/ingestionController";
import multer from "multer";
import { uploadConfig } from "../../../config/multerConfig";

const router = Router();
const upload = multer(uploadConfig);

router.get("/resume/health", ingestionController.health);
router.post("/resume/upload", upload.single("file"), ingestionController.uploadResume);
router.post("/resume/extract", upload.single("file"), ingestionController.extractText);
router.post("/resume/clean", ingestionController.cleanText);
router.post("/resume/regex", ingestionController.extractRegexMatches);
router.post("/resume/skills", ingestionController.detectSkills);
router.post("/resume/parse", ingestionController.parseResume);
router.post("/resume/llm-parse", ingestionController.parseResumeWithLlm);
router.post("/resume/embed", ingestionController.generateEmbedding);
router.post("/resume/store", ingestionController.storeResume);
router.post("/resume/ingest", upload.single("file"), ingestionController.ingestResume);

export default router;
