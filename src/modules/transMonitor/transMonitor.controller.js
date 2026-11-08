import * as transMonitorService from "./transMonitor.service.js";
import * as apiTransactionOptionsService from "../../services/apiTransactionOptions.service.js";
import { resolveFacilityIds } from "../../utils/resolveFacilityIds.js";
import { convertDateTimeByTimezone } from "../../utils/datetime.js";
import { handleController } from "../../utils/controller.js";
import { getPagination } from "../../utils/pagination.js";

const cleanParam = (val) => {
  if (
    val === undefined ||
    val === null ||
    val === "" ||
    val === "null" ||
    val === "undefined"
  ) {
    return null;
  }
  return typeof val === "string" ? val.trim() : val;
};

const buildQueryOptions = (queryParams, userTimezone) => {
  const { pageNum: page, limitNum: limit } = getPagination(
    queryParams.page,
    queryParams.limit,
  );

  let date_start;
  const rawDateStart = cleanParam(queryParams.date_start);
  if (rawDateStart) {
    date_start = convertDateTimeByTimezone(rawDateStart, userTimezone);
  } else {
    const now = new Date();
    date_start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  let date_end;
  const rawDateEnd = cleanParam(queryParams.date_end);
  if (rawDateEnd) {
    date_end = convertDateTimeByTimezone(rawDateEnd, userTimezone);
  }

  return {
    page,
    limit,
    date_start,
    date_end,
    payer_id: cleanParam(queryParams.payer_id),
    api_name: cleanParam(queryParams.api_name),
    api_function: cleanParam(queryParams.api_function),
    status: cleanParam(queryParams.status),
    trans_id: cleanParam(queryParams.trans_id),
    bundle_id: cleanParam(queryParams.bundle_id),
    api_provider: cleanParam(queryParams.api_provider),
    patient_id: cleanParam(queryParams.patient_id),
    transaction_status: cleanParam(queryParams.transaction_status),
  };
};

export const getPayers = handleController(async (req, res) => {
  const userTimezone = req.headers.tz || "UTC";
  const options = buildQueryOptions(req.query, userTimezone);
  options.facilityIds = await resolveFacilityIds(req);

  const result = await transMonitorService.getPayers(options);
  return res.status(200).json({ msg: "Success", ...result });
}, "An unexpected error occurred.");

export const getTransSummary = handleController(async (req, res) => {
  const userTimezone = req.headers.tz || "UTC";
  const options = buildQueryOptions(req.query, userTimezone);
  options.facilityIds = await resolveFacilityIds(req);

  const result = await transMonitorService.getTransSummary(options);
  return res.status(200).json({ msg: "Success", ...result });
}, "An unexpected error occurred.");

export const getTransDetails = handleController(async (req, res) => {
  const userTimezone = req.headers.tz || "UTC";
  const options = buildQueryOptions(req.query, userTimezone);
  options.facilityIds = await resolveFacilityIds(req);

  const result = await transMonitorService.getTransDetails(options);
  return res.status(200).json({ msg: "Success", ...result });
}, "An unexpected error occurred.");

export const getTransErrors = handleController(async (req, res) => {
  const transId = cleanParam(req.query.trans_id) || -1000;
  const { pageNum: page, limitNum: limit } = getPagination(
    req.query.page,
    req.query.limit,
  );

  const result = await transMonitorService.getTransErrors(transId, page, limit);
  return res.status(200).json({ msg: "Success", ...result });
}, "An unexpected error occurred.");

export const getTransResponses = handleController(async (req, res) => {
  const transId = cleanParam(req.query.trans_id) || -1000;
  const result = await transMonitorService.getTransResponses(transId);
  return res.status(200).json({ msg: "Success", ...result });
}, "An unexpected error occurred.");

export const getPollDetails = handleController(async (req, res) => {
  const { pageNum: page, limitNum: limit } = getPagination(
    req.query.page,
    req.query.limit,
  );
  const transId = cleanParam(req.query.trans_id) || -1000;

  const result = await transMonitorService.getPollDetails(transId, page, limit);
  return res.status(200).json({ msg: "Success", ...result });
}, "An unexpected error occurred.");

export const getFilterOptions = handleController(async (req, res) => {
  const data = await apiTransactionOptionsService.getFilterOptions({
    startDate: cleanParam(req.query.date_start),
    endDate: cleanParam(req.query.date_end),
    payerId: cleanParam(req.query.payer_id),
    apiProvider: cleanParam(req.query.api_provider),
    apiName: cleanParam(req.query.api_name),
    apiFunction: cleanParam(req.query.api_function),
    status: cleanParam(req.query.transaction_status),
    facilityIds: await resolveFacilityIds(req),
  });

  return res.status(200).json({ success: true, data });
}, "An unexpected error occurred.");
