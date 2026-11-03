import * as claimValidationService from "./claimValidation.service.js";
import { ok } from "@givc/shared-backend";
import { getDefaultFacilityByUserId } from "../../utils/facilityHelper.js";
import { handleController } from "../../utils/controller.js";

const requireFacilityId = async (userId) => {
  const facility = await getDefaultFacilityByUserId(userId);
  if (!facility?.facility_id) {
    throw new Error("Default facility not found for user");
  }
  return facility.facility_id;
};

const getFacilityIdIfNeeded = async (userId, scope) => {
  if (scope === "day" || scope === "hour") {
    return requireFacilityId(userId);
  }
  return null;
};

export const getAllClaims = handleController(
  async (req, res) => {
    const facilityId = await requireFacilityId(req.user?.userId);

    const result = await claimValidationService.getAllClaims({
      filters: req.query,
      queryParams: req.query,
      facilityId,
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
    });
  },
  "Failed to fetch claims",
);

export const getReqCountByType = handleController(
  async (req, res) => {
    const facilityId = await requireFacilityId(req.user?.userId);

    const result = await claimValidationService.getReqCountByType({
      filters: req.query,
      queryParams: req.query,
      facilityId,
    });

    const data = result.data.map((row) => ({
      req_type: row.req_type || "ALL",
      count: parseInt(row.count),
      amount: parseFloat(row.amount),
    }));

    return res.status(200).json({
      success: true,
      data,
      total: data.length,
    });
  },
  "Failed to fetch claims count",
);

export const getPatientsDetails = handleController(
  async (req, res) => {
    const facilityId = await requireFacilityId(req.user?.userId);

    const result = await claimValidationService.getPatientsDetails({
      filters: req.query,
      queryParams: req.query,
      facilityId,
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total || 0,
    });
  },
  "Failed to fetch patients details",
);

export const getReqCountByStatus = handleController(
  async (req, res) => {
    const facilityId = await requireFacilityId(req.user?.userId);

    const result = await claimValidationService.getReqCountByStatus({
      filters: req.query,
      queryParams: req.query,
      facilityId,
    });

    const data = result.data.map((row) => ({
      status: row.status,
      count: parseInt(row.count),
      amount: parseFloat(row.amount),
    }));

    return res.status(200).json({
      success: true,
      data,
      total: data.length,
    });
  },
  "Failed to fetch claims count",
);

export const getClaimsStatisticsGrouped = handleController(
  async (req, res) => {
    const facilityId = await requireFacilityId(req.user?.userId);

    const result = await claimValidationService.getClaimsStatisticsGrouped({
      filters: req.query,
      queryParams: req.query,
      facilityId,
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      group_by: result.groupBy,
    });
  },
  "Failed to fetch grouped statistics",
);

export const getDiagnosis = handleController(
  async (req, res) => {
    const result = await claimValidationService.getDiagnosis(req.query.search);
    return res.status(200).json({ success: true, data: result.data });
  },
  "Failed to fetch diagnosis codes",
);

export const getServices = handleController(
  async (req, res) => {
    const result = await claimValidationService.getServices(req.query.search);
    return res.status(200).json({ success: true, data: result.data });
  },
  "Failed to fetch service items",
);

export const getValidationCodes = handleController(
  async (req, res) => {
    const result = await claimValidationService.getValidationCodes(
      req.query.search,
    );
    return res.status(200).json({ success: true, data: result.data });
  },
  "Failed to fetch validation codes",
);

export const getPhysicians = handleController(
  async (req, res) => {
    const result = await claimValidationService.getPhysicians(req.query.search);
    return res.status(200).json({ success: true, data: result.data });
  },
  "Failed to fetch physicians",
);

export const getAllFacilitiesClaimData = handleController(
  async (req, res) => {
    const result = await claimValidationService.getFacilitiesClaimData({
      start_date: req.query.start_date,
      end_date: req.query.end_date,
    });
    return ok(res, result.data);
  },
  "Failed to fetch facilities claim data",
);

export const getAllFacilitiesClaimDataReport = handleController(
  async (req, res) => {
    const { buffer, contentType, filename } =
      await claimValidationService.buildFacilitiesReport({
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        userId: req.user.userId,
      });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  },
  "Failed to generate transaction report",
);

export const getTypeTimelineData = handleController(
  async (req, res) => {
    const { scope } = req.params;
    const facilityId = await getFacilityIdIfNeeded(req.user.userId, scope);

    const result = await claimValidationService.getTypeTimelineData({
      scope,
      filters: req.query,
      queryParams: req.query,
      facilityId,
    });

    const data = result.data.map((row) => ({
      ...row,
      claim: Number(row.claim),
      "pre-auth": Number(row["pre-auth"]),
      services: Number(row.services),
      prescription: Number(row.prescription),
    }));

    return res.status(200).json({
      message: "success",
      data,
      total: result.total,
      query: result.query,
    });
  },
  "Failed to get timeline data",
);

export const getStatusTimelineData = handleController(
  async (req, res) => {
    const { scope } = req.params;
    const facilityId = await getFacilityIdIfNeeded(req.user.userId, scope);

    const result = await claimValidationService.getStatusTimelineData({
      scope,
      filters: req.query,
      queryParams: req.query,
      facilityId,
    });

    const data = result.data.map((row) => ({
      ...row,
      new: Number(row.new),
      recheck: Number(row.recheck),
      resolved: Number(row.resolved),
      ignore: Number(row.ignore),
    }));

    return res.status(200).json({
      message: "success",
      data,
      total: result.total,
      query: result.query,
    });
  },
  "Failed to get timeline data",
);
