import express from "express";
import * as eligibilityController from "./eligibility.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/apiTrans/:apiTransId", eligibilityController.getApiTrans);
router.get("/responseTrans/:response_id", eligibilityController.getResponseDetail);

export default router;
