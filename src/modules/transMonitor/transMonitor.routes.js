import express from "express";
import * as transMonitorController from "./transMonitor.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/payers", transMonitorController.getPayers);
router.get("/trans_summaries", transMonitorController.getTransSummary);
router.get("/trans_details", transMonitorController.getTransDetails);
router.get("/trans_errors", transMonitorController.getTransErrors);
router.get("/trans_responses", transMonitorController.getTransResponses);
router.get("/poll_details", transMonitorController.getPollDetails);

router.get("/options/filter", transMonitorController.getFilterOptions);

export default router;
