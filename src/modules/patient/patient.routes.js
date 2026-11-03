import express from "express";
import * as patientController from "./patient.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/v2", patientController.getPatientsV2);

export default router;
