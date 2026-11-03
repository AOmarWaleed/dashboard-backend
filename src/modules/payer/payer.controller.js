import * as payerService from "./payer.service.js";
import { getDefaultFacilityByUserId } from "../../utils/facilityHelper.js";
import { handleController } from "../../utils/controller.js";

export const getPayersV2 = handleController(
  async (req, res) => {
    const { search } = req.query;
    const { userId } = req.user || {};

    const facility = await getDefaultFacilityByUserId(userId);
    const facilityId = facility ? facility.facility_id : null;

    const payers = search
      ? await payerService.searchPayersV2(search, facilityId)
      : await payerService.getPayersV2(facilityId);

    return res.status(200).json({
      msg: "Success",
      data: payers,
      numOfPayers: payers.length,
    });
  },
  "Failed to fetch payers",
);
