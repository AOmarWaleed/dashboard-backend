import express from "express";
import * as transActionAnalysisController from "./transActionAnalysis.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/error-graph", transActionAnalysisController.errorGraph);

export default router;
