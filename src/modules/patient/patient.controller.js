import * as patientService from "./patient.service.js";
import { handleController } from "../../utils/controller.js";

export const getPatientsV2 = handleController(
  async (req, res) => {
    const hasQueryParams = Object.keys(req.query).length > 0;

    const patients = hasQueryParams
      ? await patientService.searchPatientsV2(req.query)
      : await patientService.getAllPatientsV2();

    return res.status(200).json({
      msg: "Success",
      data: patients,
      numOfPatients: patients.length,
    });
  },
  "Failed to fetch patients",
);
