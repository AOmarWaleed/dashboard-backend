import express from "express";
import * as transactionAnalysisController from "./transactionAnalysis.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get(
  "/filter-options",
  transactionAnalysisController.getFilterOptions,
);
router.get(
  "/getApiSummaryReport",
  transactionAnalysisController.getApiSummaryReport,
);
router.get(
  "/getHourlyApiPerformance",
  transactionAnalysisController.getHourlyApiPerformance,
);
router.get(
  "/getDailyApiPerformance",
  transactionAnalysisController.getDailyApiPerformance,
);
router.get(
  "/getTopFailedErrorsSummary",
  transactionAnalysisController.getTopFailedErrorsSummary,
);
router.get(
  "/getTopFailedErrorsDetails",
  transactionAnalysisController.getTopFailedErrorsDetails,
);
router.get(
  "/getErrorMessageSummary",
  transactionAnalysisController.getErrorMessageSummary,
);
router.get(
  "/getErrorCodeSummary",
  transactionAnalysisController.getErrorCodeSummary,
);
router.get(
  "/getErrorDailyPerformance",
  transactionAnalysisController.getErrorDailyPerformance,
);
router.get(
  "/getErrorHourlyPerformance",
  transactionAnalysisController.getErrorHourlyPerformance,
);
router.get(
  "/getFacilitySummary",
  transactionAnalysisController.getFacilitySummary,
);
router.get(
  "/getFacilityApiNameGrid",
  transactionAnalysisController.getFacilityApiNameGrid,
);
router.get(
  "/getFacilityDailyPerformance",
  transactionAnalysisController.getFacilityDailyPerformance,
);
router.get(
  "/getFacilityHourlyPerformance",
  transactionAnalysisController.getFacilityHourlyPerformance,
);
router.get(
  "/getErrorMessageDetails",
  transactionAnalysisController.getErrorMessageDetails,
);
router.get(
  "/getErrorMessageMessages",
  transactionAnalysisController.getErrorMessageMessages,
);
router.get(
  "/getPayerPerformanceSummary",
  transactionAnalysisController.getPayerPerformanceSummary,
);
router.get(
  "/getClaimRejectionSummary",
  transactionAnalysisController.getClaimRejectionSummary,
);
router.get(
  "/getClaimRejectionDetails",
  transactionAnalysisController.getClaimRejectionDetails,
);

export default router;
