import * as confService from "./conf.service.js";
import { handleController } from "../../utils/controller.js";

export const getConfValue = handleController(
  async (req, res) => {
    const conf = await confService.getConfValue(req.params.conf_key);

    if (!conf) {
      return res.status(404).json({ error: "Configuration key not found" });
    }

    return res.status(200).json(conf);
  },
  "Failed to fetch configuration",
);
