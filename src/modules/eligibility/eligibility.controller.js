import * as eligibilityService from "./eligibility.service.js";
import { handleController } from "../../utils/controller.js";

export const getApiTrans = handleController(async (req, res) => {
  const data = await eligibilityService.getApiTrans(req.params.apiTransId);

  return res.status(200).json({ msg: "Success", data });
}, "Failed to fetch API transaction");

export const getResponseDetail = handleController(async (req, res) => {
  const data = await eligibilityService.getResponseDetail(req.params.response_id);

  return res.status(200).json({ msg: "Success", data });
}, "Failed to fetch response detail");
