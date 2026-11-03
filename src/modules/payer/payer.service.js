import { query } from "../../config/database.js";

const PAYER_COLUMNS = `
  payer_id, payer_bk, description, address_1, address_2, address_3,
  address_4, tel_no, contact, email_address, eligibility_no_days,
  eligibility_no_visits, price_date, cchi_no, claim_config_id, active,
  nphies_license, provider_id, non_mapped_service_code, is_tpa, facility_id,
  send_medication_as_pharmacy, shadow_billing_code, created_by, creation_date,
  modified_by, modification_date, tpa_id, icon, short_name, vat_register_no,
  claim_in_open_episode, claim_out_open_episode, icon_file_name, street_name,
  building_no, his_payer_id
`;

export const getPayersV2 = async (facilityId) => {
  const params = [];
  let facilityFilter = "";

  if (facilityId) {
    params.push(facilityId);
    facilityFilter = " WHERE facility_id = $1";
  }

  const { rows } = await query(
    `SELECT ${PAYER_COLUMNS}
       FROM rcm.payer${facilityFilter}
      LIMIT 100`,
    params,
  );
  return rows;
};

export const searchPayersV2 = async (search, facilityId) => {
  const params = [`%${search}%`];
  let facilityFilter = "";

  if (facilityId) {
    params.push(facilityId);
    facilityFilter = ` AND p.facility_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT ${PAYER_COLUMNS}
       FROM rcm.payer p
      WHERE (p.payer_id || ' ' || p.payer_bk || ' ' || p.description || ' ' || p.short_name) ILIKE $1${facilityFilter}
      LIMIT 20`,
    params,
  );
  return rows;
};
