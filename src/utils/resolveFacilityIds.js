import {
  getDefaultFacilityByUserId,
  getUserFacilityIdsByUserId,
} from "./facilityHelper.js";

export const resolveFacilityIds = async (req) => {
  if (req.query.facility_id) {
    return [Number(req.query.facility_id)];
  }

  if (
    req.query.all_facilities === "true" ||
    req.query.all_facilities === true
  ) {
    const userFacilities = await getUserFacilityIdsByUserId(req?.user?.userId);
    return userFacilities.length > 0 ? userFacilities : [-1];
  }

  const defaultFacility = await getDefaultFacilityByUserId(req?.user?.userId);
  return defaultFacility?.facility_id ? [defaultFacility.facility_id] : [-1];
};
