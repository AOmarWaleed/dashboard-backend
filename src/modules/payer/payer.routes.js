import express from "express";
import * as payerController from "./payer.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/v2", payerController.getPayersV2);

export default router;
