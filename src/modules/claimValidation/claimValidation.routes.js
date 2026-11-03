import express from "express";
import * as claimValidationController from "./claimValidation.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", claimValidationController.getAllClaims);
router.get("/statistics", claimValidationController.getClaimsStatisticsGrouped);
router.get("/req-count-by-type", claimValidationController.getReqCountByType);
router.get(
  "/patients-by-req-type",
  claimValidationController.getPatientsDetails,
);
router.get(
  "/req-count-by-status",
  claimValidationController.getReqCountByStatus,
);

router.get("/diagnosis", claimValidationController.getDiagnosis);
router.get("/services", claimValidationController.getServices);
router.get("/physicians", claimValidationController.getPhysicians);
router.get("/validation-codes", claimValidationController.getValidationCodes);

router.get(
  "/get-validations-by-facility",
  claimValidationController.getAllFacilitiesClaimData,
);
router.get(
  "/get-validations-by-facility-report",
  claimValidationController.getAllFacilitiesClaimDataReport,
);

router.get(
  "/typesTimelineData/:scope",
  claimValidationController.getTypeTimelineData,
);
router.get(
  "/statusTimelineData/:scope",
  claimValidationController.getStatusTimelineData,
);

export default router;
