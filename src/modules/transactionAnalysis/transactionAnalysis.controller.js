import * as transactionAnalysisService from "./transactionAnalysis.service.js";
import * as apiTransactionOptionsService from "../../services/apiTransactionOptions.service.js";
import { resolveFacilityIds } from "../../utils/resolveFacilityIds.js";
import { handleController } from "../../utils/controller.js";
import { DEFAULT_LIMIT, DEFAULT_PAGE } from "../../utils/pagination.js";
import { convertDateTimeByTimezone } from "../../utils/datetime.js";

const getFilters = async (req) => {
  const userTimezone = req.headers.tz || "UTC";

  let startDate = req.query.start_date || req.query.date_start || null;
  if (startDate) {
    startDate = convertDateTimeByTimezone(startDate, userTimezone);
  } else {
    const now = new Date();
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  let endDate = req.query.end_date || req.query.date_end || null;
  if (endDate) {
    endDate = convertDateTimeByTimezone(endDate, userTimezone);
  }

  let apiTransId = req.query.api_trans_id || req.query.trans_id || null;
  let bundleId = req.query.bundle_id || null;
  let payerId = req.query.payer_id || null;
  let apiName = req.query.api_name || null;
  let apiFunction = req.query.api_function || null;
  let status = req.query.transaction_status || req.query.status || null;
  let apiProvider = req.query.api_provider || null;

  if (apiTransId) bundleId = null;

  if (apiTransId || bundleId) {
    startDate = "0001-01-01 00:00";
    endDate = "9999-01-01 00:00";
    payerId = null;
    apiName = null;
    apiFunction = null;
    status = null;
  }

  return {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    apiFunction,
    status,
    facilityIds: await resolveFacilityIds(req),
    patientId: req.query.patient_id || null,
    msgId: req.query.msg_id || null,
    first: req.query.first || null,
    last: req.query.last || null,
    page: req.query.page || DEFAULT_PAGE,
    limit: req.query.limit || DEFAULT_LIMIT,
    apiTransId,
    bundleId,
    nphiesMessageId: req.query.nphies_message_id || null,
    nphiesMessage: req.query.nphies_message || null,
    nphiesCode: req.query.nphies_code || null,
    dayTs: req.query.day_ts || null,
    facilityId: req.query.facility_id || null,
    errorMessage: req.query.error_message || null,
    dataBin: req.query.data_bin || null,
    _sort: req.query._sort || null,
    _filter: req.query._filter || null,
  };
};

export const getFilterOptions = handleController(
  async (req, res) => {
    const data = await apiTransactionOptionsService.getFilterOptions(
      await getFilters(req),
    );
    return res.status(200).json({ success: true, data });
  },
  "Failed to fetch filter options",
);

export const getApiSummaryReport = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getApiSummaryReport(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch API summary report",
);

export const getHourlyApiPerformance = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getHourlyApiPerformance(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch hourly API performance",
);

export const getDailyApiPerformance = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getDailyApiPerformance(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch daily API performance",
);

export const getTopFailedErrorsSummary = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getTopFailedErrorsSummary(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch top failed errors summary",
);

export const getTopFailedErrorsDetails = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getTopFailedErrorsDetails(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch top failed errors details",
);

export const getErrorMessageSummary = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getErrorMessageSummary(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch error message summary",
);

export const getErrorMessageDetails = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getErrorMessageDetails(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch error message details",
);

export const getErrorMessageMessages = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getErrorMessageMessages(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch error message messages",
);

export const getPayerPerformanceSummary = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getPayerPerformanceSummary(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch payer performance summary",
);

export const getErrorCodeSummary = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getErrorCodeSummary(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch error code summary",
);

export const getErrorDailyPerformance = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getErrorDailyPerformance(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch error daily performance",
);

export const getErrorHourlyPerformance = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getErrorHourlyPerformance(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch error hourly performance",
);

export const getFacilitySummary = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getFacilitySummary(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch facility summary",
);

export const getFacilityApiNameGrid = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getFacilityApiNameGrid(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch facility API name grid",
);

export const getFacilityDailyPerformance = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getFacilityDailyPerformance(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch facility daily performance",
);

export const getFacilityHourlyPerformance = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getFacilityHourlyPerformance(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch facility hourly performance",
);

export const getClaimRejectionSummary = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getClaimRejectionSummary(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch claim rejection summary",
);

export const getClaimRejectionDetails = handleController(
  async (req, res) => {
    const data = await transactionAnalysisService.getClaimRejectionDetails(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch claim rejection details",
);
