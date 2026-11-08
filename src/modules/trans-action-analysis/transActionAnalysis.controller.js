import * as transActionAnalysisService from "./transActionAnalysis.service.js";
import { resolveFacilityIds } from "../../utils/resolveFacilityIds.js";
import { handleController } from "../../utils/controller.js";
import { convertDateTimeByTimezone } from "../../utils/datetime.js";

const getFilters = async (req) => {
  const userTimezone = req.headers.tz || "UTC";

  let startDate = req.query.date_start || req.query.start_date || null;
  if (startDate) {
    startDate = convertDateTimeByTimezone(startDate, userTimezone);
  } else {
    const now = new Date();
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  let endDate = req.query.date_end || req.query.end_date || null;
  if (endDate) {
    endDate = convertDateTimeByTimezone(endDate, userTimezone);
  }
  return {
    startDate,
    endDate,
    last: req.query.last || null,
    apiName: req.query.api_name || null,
    apiFunction: req.query.api_function || null,
    apiProvider: req.query.api_provider || null,
    status: req.query.transaction_status || req.query.status || null,
    dataBin: req.query.data_bin || "5 minute",
    facilityIds: await resolveFacilityIds(req),
    statuses: req.query.statuses || [],
  };
};

export const errorGraph = handleController(async (req, res) => {
  const data = await transActionAnalysisService.errorGraph(
    await getFilters(req),
  );
  return res.status(200).json(data);
}, "Failed to fetch error graph");
