import express from "express";
import * as dashboardController from "./dashboard.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);


router.get("/rejectionByTime", dashboardController.rejectionByTime);
router.get("/topErrors", dashboardController.topErrors);
router.get("/topPayers", dashboardController.topPayers);
router.get("/topDiagnosis", dashboardController.topDiagnosis);
router.get("/topServices", dashboardController.topServices);
router.get("/topPhysicians", dashboardController.topPhysicians);

router.get("/lookups/payers", dashboardController.getPayerLookups);
router.get("/lookups/errors", dashboardController.getErrorCodeLookups);
router.get("/lookups/diagnosis", dashboardController.getDiagnosisCodeLookups);
router.get("/lookups/services", dashboardController.getServiceLookups);
router.get("/lookups/physicians", dashboardController.getPhysicianLookups);

router.get("/rejectionCount", dashboardController.getRejectionCount);
router.get("/rejectionAmount", dashboardController.getRejectionAmount);
router.get("/rejectionRate", dashboardController.getRejectionRate);

router.get("/getErrorCodes", dashboardController.getErrorCodes);
router.get("/getClaims", dashboardController.getClaims);
router.get("/getServices", dashboardController.getServices);

export default router;
