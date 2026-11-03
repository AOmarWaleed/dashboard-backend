import * as transActionAnalysisService from "./transActionAnalysis.service.js";
import { resolveFacilityIds } from "../../utils/resolveFacilityIds.js";
import { handleController } from "../../utils/controller.js";

const getFilters = async (req) => ({
  startDate: req.query.date_start || req.query.start_date || null,
  endDate: req.query.date_end || req.query.end_date || null,
  last: req.query.last || null,
  apiName: req.query.api_name || null,
  apiFunction: req.query.api_function || null,
  apiProvider: req.query.api_provider || null,
  status: req.query.status || null,
  dataBin: req.query.data_bin || "5 minute",
  facilityIds: await resolveFacilityIds(req),
});

export const errorGraph = handleController(
  async (req, res) => {
    const data = await transActionAnalysisService.errorGraph(
      await getFilters(req),
    );
    return res.status(200).json(data);
  },
  "Failed to fetch error graph",
);
