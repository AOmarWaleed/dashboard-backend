import * as transMonitorService from "./transMonitor.service.js";
import * as apiTransactionOptionsService from "../../services/apiTransactionOptions.service.js";
import { resolveFacilityIds } from "../../utils/resolveFacilityIds.js";
import { convertDateTimeByTimezone } from "../../utils/datetime.js";
import { handleController } from "../../utils/controller.js";
import { getPagination } from "../../utils/pagination.js";

export const getPayers = handleController(
  async (req, res) => {
    const userTimezone = req.headers.tz || "UTC";
    const options = buildQueryOptions(req.query, userTimezone);
    options.facilityIds = await resolveFacilityIds(req);

    const result = await transMonitorService.getPayers(options);
    return res.status(200).json({ msg: "Success", ...result });
  },
  "An unexpected error occurred.",
);

export const getTransSummary = handleController(
  async (req, res) => {
    const userTimezone = req.headers.tz || "UTC";
    const options = buildQueryOptions(req.query, userTimezone);
    options.facilityIds = await resolveFacilityIds(req);

    const result = await transMonitorService.getTransSummary(options);
    return res.status(200).json({ msg: "Success", ...result });
  },
  "An unexpected error occurred.",
);

export const getTransDetails = handleController(
  async (req, res) => {
    const userTimezone = req.headers.tz || "UTC";
    const options = buildQueryOptions(req.query, userTimezone);
    options.facilityIds = await resolveFacilityIds(req);

    const result = await transMonitorService.getTransDetails(options);
    return res.status(200).json({ msg: "Success", ...result });
  },
  "An unexpected error occurred.",
);

export const getTransErrors = handleController(
  async (req, res) => {
    const queryParams = req.query;

    const transId = queryParams.trans_id || -1000;
    queryParams.trans_id && delete queryParams.trans_id;

    const { pageNum: page, limitNum: limit } = getPagination(
      queryParams.page,
      queryParams.limit,
    );
    queryParams.page && delete queryParams.page;
    queryParams.limit && delete queryParams.limit;

    const result = await transMonitorService.getTransErrors(
      transId,
      page,
      limit,
    );
    return res.status(200).json({ msg: "Success", ...result });
  },
  "An unexpected error occurred.",
);

export const getTransResponses = handleController(
  async (req, res) => {
    const queryParams = req.query;

    const transId = queryParams.trans_id || -1000;
    queryParams.trans_id && delete queryParams.trans_id;

    const result = await transMonitorService.getTransResponses(transId);
    return res.status(200).json({ msg: "Success", ...result });
  },
  "An unexpected error occurred.",
);

export const getPollDetails = handleController(
  async (req, res) => {
    const queryParams = req.query;

    const { pageNum: page, limitNum: limit } = getPagination(
      queryParams.page,
      queryParams.limit,
    );
    queryParams.page && delete queryParams.page;
    queryParams.limit && delete queryParams.limit;

    const transId = queryParams.trans_id || -1000;
    queryParams.trans_id && delete queryParams.trans_id;

    const result = await transMonitorService.getPollDetails(
      transId,
      page,
      limit,
    );
    return res.status(200).json({ msg: "Success", ...result });
  },
  "An unexpected error occurred.",
);

export const getFilterOptions = handleController(
  async (req, res) => {
    const data = await apiTransactionOptionsService.getFilterOptions({
      startDate: req.query.date_start || null,
      endDate: req.query.date_end || null,
      payerId: req.query.payer_id || null,
      apiProvider: req.query.api_provider || null,
      apiName: req.query.api_name || null,
      apiFunction: req.query.api_function || null,
      status: req.query.transaction_status || null,
      facilityIds: await resolveFacilityIds(req),
    });

    return res.status(200).json({ success: true, data });
  },
  "An unexpected error occurred.",
);

const buildQueryOptions = (queryParams, userTimezone) => {
  const { pageNum: page, limitNum: limit } = getPagination(
    queryParams.page,
    queryParams.limit,
  );
  queryParams.page && delete queryParams.page;
  queryParams.limit && delete queryParams.limit;

  let date_start;
  if (queryParams.date_start) {
    date_start = convertDateTimeByTimezone(queryParams.date_start, userTimezone);
    delete queryParams.date_start;
  } else {
    const now = new Date();
    date_start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  let date_end;
  if (queryParams.date_end) {
    date_end = convertDateTimeByTimezone(queryParams.date_end, userTimezone);
    delete queryParams.date_end;
  }

  const payer_id = queryParams.payer_id || null;
  queryParams.payer_id && delete queryParams.payer_id;

  const api_name = queryParams.api_name || null;
  queryParams.api_name && delete queryParams.api_name;

  const api_function = queryParams.api_function || null;
  queryParams.api_function && delete queryParams.api_function;

  const patient_id = queryParams.patient_id || null;
  queryParams.patient_id && delete queryParams.patient_id;

  const status = queryParams.status || null;
  queryParams.status && delete queryParams.status;

  const trans_id = queryParams.trans_id || null;
  queryParams.trans_id && delete queryParams.trans_id;

  const bundle_id = queryParams.bundle_id || null;
  queryParams.bundle_id && delete queryParams.bundle_id;

  const api_provider = queryParams.api_provider || null;
  queryParams.api_provider && delete queryParams.api_provider;

  const transaction_status = queryParams.transaction_status || null;
  queryParams.transaction_status && delete queryParams.transaction_status;

  return {
    page,
    limit,
    date_start,
    date_end,
    payer_id,
    api_name,
    api_function,
    status,
    trans_id,
    bundle_id,
    api_provider,
    patient_id,
    transaction_status,
  };
};
