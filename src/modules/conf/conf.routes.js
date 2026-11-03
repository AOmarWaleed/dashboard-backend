import express from "express";
import * as confController from "./conf.controller.js";

const router = express.Router();

router.get("/:conf_key", confController.getConfValue);

export default router;
