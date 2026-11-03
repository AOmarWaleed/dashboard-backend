import * as dashboardService from "./dashboard.service.js";
import { getDefaultFacilityByUserId } from "../../utils/facilityHelper.js";
import { handleController } from "../../utils/controller.js";

const getDashboardFilters = (req) => ({
  date_start: req.query.date_start ?? undefined,
  date_end: req.query.date_end ?? undefined,
  payer_id: req.query.payer_id ?? undefined,
  error_code: req.query.error_code ?? undefined,
  diagnosis_code: req.query.diagnosis_code ?? undefined,
  physician_id: req.query.physician_id ?? undefined,
  service_code: req.query.service_code ?? undefined,
});

export const rejectionByTime = handleController(
  async (req, res) => {
    const data = await dashboardService.rejectionByTime(
      getDashboardFilters(req),
    );
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const topErrors = handleController(
  async (req, res) => {
    const data = await dashboardService.topErrors({
      ...getDashboardFilters(req),
      date: req.query.date ?? undefined,
      limit: req.query.limit ?? undefined,
    });
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const topPayers = handleController(
  async (req, res) => {
    const data = await dashboardService.topPayers(getDashboardFilters(req));
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const topDiagnosis = handleController(
  async (req, res) => {
    const data = await dashboardService.topDiagnosis(getDashboardFilters(req));
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const topServices = handleController(
  async (req, res) => {
    const data = await dashboardService.topServices(getDashboardFilters(req));
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const topPhysicians = handleController(
  async (req, res) => {
    const data = await dashboardService.topPhysicians({
      ...getDashboardFilters(req),
      limit: req.query.limit ?? undefined,
    });
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const getPayerLookups = handleController(
  async (req, res) => {
    const facility = await getDefaultFacilityByUserId(req.user?.userId);
    const data = await dashboardService.getPayerLookups({
      searchValue: req.query._search,
      facilityId: facility ? facility.facility_id : null,
    });
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const getErrorCodeLookups = handleController(
  async (req, res) => {
    const data = await dashboardService.getErrorCodeLookups({
      searchValue: req.query._search,
    });
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const getDiagnosisCodeLookups = handleController(
  async (req, res) => {
    const data = await dashboardService.getDiagnosisCodeLookups({
      searchValue: req.query._search,
    });
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const getServiceLookups = handleController(
  async (req, res) => {
    const data = await dashboardService.getServiceLookups({
      searchValue: req.query._search,
    });
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const getPhysicianLookups = handleController(
  async (req, res) => {
    const data = await dashboardService.getPhysicianLookups({
      searchValue: req.query._search,
    });
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const getRejectionCount = handleController(
  async (req, res) => {
    const data = await dashboardService.getRejectionCount(
      getDashboardFilters(req),
    );
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const getRejectionAmount = handleController(
  async (req, res) => {
    const data = await dashboardService.getRejectionAmount({
      ...getDashboardFilters(req),
      limit: req.query.limit ?? undefined,
    });
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const getRejectionRate = handleController(
  async (req, res) => {
    const data = await dashboardService.getRejectionRate(
      getDashboardFilters(req),
    );
    return res.status(200).json(data);
  },
  "An unexpected error occurred.",
);

export const getErrorCodes = handleController(
  async (req, res) => {
    const queryResult = await dashboardService.getErrorCodes(req);
    return res.status(200).json({
      sucess: true,
      data: queryResult.data,
      total: queryResult.total,
      msg: "Success",
    });
  },
  "An unexpected error occurred.",
);

export const getClaims = handleController(
  async (req, res) => {
    if (!req.query.msg_id) {
      return res.status(200).json({
        sucess: true,
        data: [],
        total: 0,
        msg: "Success",
      });
    }

    const queryResult = await dashboardService.getClaims(req);
    return res.status(200).json({
      sucess: true,
      data: queryResult.data,
      total: queryResult.total,
      msg: "Success",
    });
  },
  "An unexpected error occurred.",
);

export const getServices = handleController(
  async (req, res) => {
    if (!req.query.claim_invoice_no) {
      return res.status(200).json({
        sucess: true,
        data: [],
        total: 0,
        msg: "claim no isn't provided yet",
      });
    }

    const queryResult = await dashboardService.getServices(req);
    return res.status(200).json({
      sucess: true,
      data: queryResult.data,
      total: queryResult.total,
      msg: "Success",
    });
  },
  "An unexpected error occurred.",
);
