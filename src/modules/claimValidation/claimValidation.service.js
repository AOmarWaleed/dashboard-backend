import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dayjs from "dayjs";

import { QueryView } from "../../utils/queryView.js";
import { getConf, reloadConfByKeys } from "../../config/conf.js";
import logger from "../../config/logger.js";

const dateFormat = () => getConf("DATE_FORMAT") || "DD-MM-YYYY";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(moduleDir, "../../../assets");

const TIMELINE_SCOPES = {
  day: { castingType: "day", format: "YYYY-MM-DD", facilityScoped: true },
  hour: { castingType: "hour", format: "HH24:00", facilityScoped: true },
  allFacilitiesDay: {
    castingType: "day",
    format: "YYYY-MM-DD",
    facilityScoped: false,
  },
  allFacilitiesHour: {
    castingType: "hour",
    format: "HH24:00",
    facilityScoped: false,
  },
};

const resolveScope = (scope) => {
  const resolved = TIMELINE_SCOPES[scope];
  if (!resolved) {
    throw new Error(`Invalid timeline scope: ${scope}`);
  }
  return resolved;
};

const applyDateRange = (whereClauses, params, start_date, end_date) => {
  if (start_date) {
    whereClauses.push("cv.creation_date >= :start_date");
    params.start_date = start_date;
  } else {
    whereClauses.push("cv.creation_date >= NOW() - INTERVAL '24 hours'");
  }

  if (end_date) {
    whereClauses.push("cv.creation_date <= :end_date");
    params.end_date = end_date;
  } else {
    whereClauses.push("cv.creation_date <= NOW()");
  }
};

export const getAllClaims = async ({
  filters,
  queryParams,
  facilityId,
}) => {
  const {
    start_date,
    end_date,
    api_trans_id,
    validation_code,
    payer_id,
    patient_id,
    item_id,
    diagnosis_code,
    req_id,
    status,
    physician_emp_id,
    req_type,
  } = filters;

  const whereClauses = [];
  const params = {};

  if (api_trans_id) {
    whereClauses.push("cv.api_trans_id = :api_trans_id");
    params.api_trans_id = api_trans_id;
  }
  if (validation_code) {
    whereClauses.push("LOWER(cv.validation_code) = LOWER(:validation_code)");
    params.validation_code = validation_code;
  }
  if (payer_id) {
    whereClauses.push("cv.payer_id = :payer_id");
    params.payer_id = payer_id;
  }
  if (patient_id) {
    whereClauses.push("cv.patient_id = :patient_id");
    params.patient_id = patient_id;
  }
  if (item_id) {
    whereClauses.push("cv.item_id = :item_id");
    params.item_id = item_id;
  }
  if (req_id) {
    whereClauses.push("cv.req_id = :req_id");
    params.req_id = req_id;
  }
  if (status) {
    whereClauses.push("LOWER(cv.status) = LOWER(:status)");
    params.status = status;
  }
  if (physician_emp_id) {
    whereClauses.push("cv.physician_emp_id = :physician_emp_id");
    params.physician_emp_id = physician_emp_id;
  }
  if (diagnosis_code) {
    whereClauses.push("LOWER(cv.diagnosis_code) = LOWER(:diagnosis_code)");
    params.diagnosis_code = diagnosis_code;
  }
  if (start_date) {
    whereClauses.push("cv.creation_date >= :start_date");
    params.start_date = start_date;
  }
  if (end_date) {
    whereClauses.push("cv.creation_date <= :end_date");
    params.end_date = end_date;
  }
  if (req_type) {
    whereClauses.push("sr.req_type = :req_type");
    params.req_type = req_type;
  }

  whereClauses.push("sr.facility_id = :facility_id");
  params.facility_id = facilityId;

  const query = `
    SELECT
        cv.error_id,
        cv.req_id,
        cv.api_trans_id,
        cv.validation_code,
        cv.created_by,
        to_char(cv.creation_date, '${dateFormat()}') as creation_date,
        cv.modified_by,
        cv.modification_date,
        to_char(cv.modification_date, '${dateFormat()}') as modification_date,
        cv.req_item_id,
        cv.diagnosis_code,
        cv.msg,
        cv.status,
        cv.payer_id,
        cv.patient_id,
        cv.item_id,
        cv.physician_emp_id,
        cv.sending_application,
        cv.sending_facility,
        p.short_name as payer_name,
        pt.patient_id as patient_id,
        pt.mrn as patient_mrn,
        concat(pt.first_name, ' ', pt.middle_names, ' ', pt.last_name) as patient_full_name,
        sri.item_desc as service_item_description,
        code_data_diagnosis.user_code as code_data_diagnosis_code,
        code_data_diagnosis.description as diagnosis_description,
        cd.description as validation_code_description,
        concat(emp.first_name, ' ', emp.middle_names, ' ', emp.last_name) as physician_full_name
    FROM claim_validation cv
    LEFT JOIN rcm.payer p
        ON cv.payer_id = p.payer_id
    LEFT JOIN rcm.patient pt
        ON cv.patient_id = pt.patient_id
    LEFT JOIN service_request_item sri
        ON cv.req_item_id = sri.req_item_id
    LEFT JOIN code_data code_data_diagnosis
        ON cv.diagnosis_code = code_data_diagnosis.user_code
        AND code_data_diagnosis.code_type = '25'
    LEFT JOIN code_data cd
        ON cv.validation_code = cd.user_code
        AND cd.code_type = '16'
    LEFT JOIN service_request sr
        ON cv.req_id = sr.req_id
    LEFT JOIN employee emp
        ON cv.physician_emp_id = emp.employee_id::varchar
    WHERE ${whereClauses.join(" AND ")}`;

  return new QueryView(query, params).apply(queryParams).execute();
};

export const getReqCountByType = async ({
  filters,
  queryParams,
  facilityId,
}) => {
  const {
    req_type,
    start_date,
    end_date,
    payer_id,
    status,
    patient_id,
    item_id,
    diagnosis_code,
    physician_emp_id,
    validation_code,
  } = filters;

  const whereClauses = ["cv.req_id IS NOT NULL"];
  const params = {};
  const isAll = req_type?.toUpperCase() === "ALL";

  if (req_type && !isAll) {
    whereClauses.push("sr.req_type = :req_type");
    params.req_type = req_type;
  }
  if (payer_id) {
    whereClauses.push("cv.payer_id = :payer_id");
    params.payer_id = payer_id;
  }
  if (patient_id) {
    whereClauses.push("cv.patient_id = :patient_id");
    params.patient_id = patient_id;
  }
  if (item_id) {
    whereClauses.push("cv.item_id = :item_id");
    params.item_id = item_id;
  }
  if (diagnosis_code) {
    whereClauses.push("LOWER(cv.diagnosis_code) = LOWER(:diagnosis_code)");
    params.diagnosis_code = diagnosis_code;
  }
  if (physician_emp_id) {
    whereClauses.push("cv.physician_emp_id = :physician_emp_id");
    params.physician_emp_id = physician_emp_id;
  }
  if (status) {
    whereClauses.push("LOWER(cv.status) = LOWER(:status)");
    params.status = status;
  }
  if (start_date) {
    whereClauses.push("cv.creation_date >= :start_date");
    params.start_date = start_date;
  }
  if (end_date) {
    whereClauses.push("cv.creation_date <= :end_date");
    params.end_date = end_date;
  }
  if (validation_code) {
    whereClauses.push("LOWER(cv.validation_code) = LOWER(:validation_code)");
    params.validation_code = validation_code;
  }

  whereClauses.push("sr.facility_id = :facility_id");
  params.facility_id = facilityId;

  const selectReqType = isAll ? "sr.req_type" : ":req_type as req_type";
  const groupBy = isAll ? "GROUP BY sr.req_type" : "";

  const query = `
    SELECT
      ${selectReqType},
      COUNT(DISTINCT sr.req_id) AS count,
      COALESCE(SUM(sr.total), 0) as amount
    FROM service_request sr
    INNER JOIN claim_validation cv
      ON sr.req_id = cv.req_id
    WHERE ${whereClauses.join(" AND ")}
    ${groupBy}`;

  return new QueryView(query, params).apply(queryParams).execute();
};

export const getPatientsDetails = async ({
  filters,
  queryParams,
  facilityId,
}) => {
  const {
    req_type,
    start_date,
    end_date,
    payer_id,
    status,
    patient_id,
    item_id,
    diagnosis_code,
    physician_emp_id,
    validation_code,
  } = filters;

  const whereClauses = ["cv.req_id IS NOT NULL"];
  const params = {};

  if (req_type) {
    whereClauses.push("sr.req_type = :req_type");
    params.req_type = req_type;
  }
  if (payer_id) {
    whereClauses.push("cv.payer_id = :payer_id");
    params.payer_id = payer_id;
  }
  if (patient_id) {
    whereClauses.push("cv.patient_id = :patient_id");
    params.patient_id = patient_id;
  }
  if (item_id) {
    whereClauses.push("cv.item_id = :item_id");
    params.item_id = item_id;
  }
  if (diagnosis_code) {
    whereClauses.push("LOWER(cv.diagnosis_code) = LOWER(:diagnosis_code)");
    params.diagnosis_code = diagnosis_code;
  }
  if (physician_emp_id) {
    whereClauses.push("cv.physician_emp_id = :physician_emp_id");
    params.physician_emp_id = physician_emp_id;
  }
  if (status) {
    whereClauses.push("LOWER(cv.status) = LOWER(:status)");
    params.status = status;
  }
  if (start_date) {
    whereClauses.push("cv.creation_date >= :start_date");
    params.start_date = start_date;
  }
  if (end_date) {
    whereClauses.push("cv.creation_date <= :end_date");
    params.end_date = end_date;
  }
  if (validation_code) {
    whereClauses.push("LOWER(cv.validation_code) = LOWER(:validation_code)");
    params.validation_code = validation_code;
  }

  whereClauses.push("sr.facility_id = :facility_id");
  params.facility_id = facilityId;

  const query = `
    SELECT
      p.patient_id,
      p.first_name,
      p.last_name,
      STRING_AGG(DISTINCT(sr.episode_no), ', ') AS episodes
    FROM nphies.claim_validation cv
    JOIN nphies.service_request sr on cv.req_id = sr.req_id
    JOIN rcm.patient p on sr.patient_id = p.patient_id
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY p.first_name, p.last_name, p.patient_id`;

  return new QueryView(query, params).apply(queryParams).execute();
};

export const getReqCountByStatus = async ({
  filters,
  queryParams,
  facilityId,
}) => {
  const {
    req_type,
    start_date,
    end_date,
    payer_id,
    status,
    patient_id,
    item_id,
    diagnosis_code,
    physician_emp_id,
    validation_code,
  } = filters;

  const whereClauses = ["cv.req_id IS NOT NULL"];
  const params = {};

  if (payer_id) {
    whereClauses.push("cv.payer_id = :payer_id");
    params.payer_id = payer_id;
  }
  if (req_type) {
    whereClauses.push("sr.req_type = :req_type");
    params.req_type = req_type;
  }
  if (patient_id) {
    whereClauses.push("cv.patient_id = :patient_id");
    params.patient_id = patient_id;
  }
  if (item_id) {
    whereClauses.push("cv.item_id = :item_id");
    params.item_id = item_id;
  }
  if (diagnosis_code) {
    whereClauses.push("LOWER(cv.diagnosis_code) = LOWER(:diagnosis_code)");
    params.diagnosis_code = diagnosis_code;
  }
  if (physician_emp_id) {
    whereClauses.push("cv.physician_emp_id = :physician_emp_id");
    params.physician_emp_id = physician_emp_id;
  }
  if (status) {
    whereClauses.push("LOWER(cv.status) = LOWER(:status)");
    params.status = status;
  }
  if (start_date) {
    whereClauses.push("cv.creation_date >= :start_date");
    params.start_date = start_date;
  }
  if (end_date) {
    whereClauses.push("cv.creation_date <= :end_date");
    params.end_date = end_date;
  }
  if (validation_code) {
    whereClauses.push("LOWER(cv.validation_code) = LOWER(:validation_code)");
    params.validation_code = validation_code;
  }

  whereClauses.push("sr.facility_id = :facility_id");
  params.facility_id = facilityId;

  const query = `
    SELECT
      COUNT(DISTINCT sr.req_id) AS count,
      COALESCE(SUM(sr.total), 0) as amount,
      cv.status
    FROM service_request sr
    INNER JOIN claim_validation cv
      ON sr.req_id = cv.req_id
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY cv.status`;

  return new QueryView(query, params).apply(queryParams).execute();
};

export const getClaimsStatisticsGrouped = async ({
  filters,
  queryParams,
  facilityId,
}) => {
  const {
    start_date,
    end_date,
    api_trans_id,
    payer_id,
    patient_id,
    item_id,
    diagnosis_code,
    req_id,
    status,
    physician_emp_id,
    validation_code,
    req_type,
  } = filters;
  const groupBy = queryParams.groupBy || "validation_code";

  let selectFields;
  let additionalJoins;
  let groupByFields;

  switch (groupBy) {
    case "physician":
      groupByFields =
        "cv.physician_emp_id, e.first_name, e.middle_names, e.last_name, e.employee_no, e.employee_job, e.main_specilaity";
      selectFields = `
        cv.physician_emp_id as code,
        CONCAT(INITCAP(e.first_name), ' ', COALESCE(e.last_name, '')) as description,
        e.employee_no,
        e.employee_job,
        e.main_specilaity as specialty`;
      additionalJoins = `
        LEFT JOIN employee e ON cv.physician_emp_id = e.employee_id::varchar`;
      break;

    case "item_id":
      groupByFields =
        "cv.item_id, i.description, i.long_description, i.category_code, i.item_type";
      selectFields = `
        cv.item_id as code,
        i.description as description,
        i.long_description,
        i.category_code,
        i.item_type`;
      additionalJoins = `
        LEFT JOIN item i ON cv.item_id = i.item_id`;
      break;

    case "req_item_id":
      groupByFields =
        "cv.req_item_id, sri.item_desc, sri.item_code, sri.item_type, sri.shadow_desc";
      selectFields = `
        cv.req_item_id as code,
        sri.item_desc as description,
        sri.item_code,
        sri.item_type,
        sri.shadow_desc`;
      additionalJoins = `
        LEFT JOIN service_request_item sri ON cv.req_item_id = sri.req_item_id`;
      break;

    case "diagnosis":
      groupByFields =
        "cv.diagnosis_code, dc.ascii_desc, dc.ascii_short_desc, dc.level, dc.valid";
      selectFields = `
        cv.diagnosis_code as code,
        dc.ascii_desc as description,
        dc.ascii_short_desc as short_description,
        dc.level,
        dc.valid`;
      additionalJoins = `
        LEFT JOIN diagnosis_code dc ON cv.diagnosis_code = dc.code_id`;
      break;

    default:
      groupByFields = "cv.validation_code, cd.description";
      selectFields = `
        cv.validation_code as code,
        cd.description as description`;
      additionalJoins = `
        LEFT JOIN code_data cd ON cv.validation_code = cd.user_code AND cd.code_type = '16'`;
      break;
  }

  const whereClauses = [];
  const params = {};

  if (api_trans_id) {
    whereClauses.push("cv.api_trans_id = :api_trans_id");
    params.api_trans_id = api_trans_id;
  }
  if (payer_id) {
    whereClauses.push("cv.payer_id = :payer_id");
    params.payer_id = payer_id;
  }
  if (patient_id) {
    whereClauses.push("cv.patient_id = :patient_id");
    params.patient_id = patient_id;
  }
  if (item_id) {
    whereClauses.push("cv.item_id = :item_id");
    params.item_id = item_id;
  }
  if (diagnosis_code) {
    whereClauses.push("LOWER(cv.diagnosis_code) = LOWER(:diagnosis_code)");
    params.diagnosis_code = diagnosis_code;
  }
  if (physician_emp_id) {
    whereClauses.push("cv.physician_emp_id = :physician_emp_id");
    params.physician_emp_id = physician_emp_id;
  }
  if (validation_code) {
    whereClauses.push("LOWER(cv.validation_code) = LOWER(:validation_code)");
    params.validation_code = validation_code;
  }
  if (status) {
    whereClauses.push("LOWER(cv.status) = LOWER(:status)");
    params.status = status;
  }
  if (req_id) {
    whereClauses.push("cv.req_id = :req_id");
    params.req_id = req_id;
  }
  if (req_type) {
    whereClauses.push("sr.req_type = :req_type");
    params.req_type = req_type;
  }
  if (start_date) {
    whereClauses.push("cv.creation_date >= :start_date");
    params.start_date = start_date;
  }
  if (end_date) {
    whereClauses.push("cv.creation_date <= :end_date");
    params.end_date = end_date;
  }

  whereClauses.push("sr.facility_id = :facility_id");
  params.facility_id = facilityId;

  const query = `
    SELECT
      ${selectFields},
      COUNT(*) as counter,
      COALESCE(SUM(sr.total), 0) as amount
    FROM claim_validation cv
    LEFT JOIN service_request sr ON cv.req_id = sr.req_id
    ${additionalJoins}
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY ${groupByFields}
    ORDER BY counter DESC
    LIMIT 100`;

  const result = await new QueryView(query, params)
    .apply(queryParams)
    .execute();

  const data = result.data.map((row) => {
    const formatted = {
      code: row.code,
      description: row.description || "N/A",
      counter: parseInt(row.counter),
      amount: parseFloat(row.amount),
    };

    if (row.employee_no) formatted.employee_no = row.employee_no;
    if (row.employee_job) formatted.employee_job = row.employee_job;
    if (row.specialty) formatted.specialty = row.specialty;
    if (row.long_description) formatted.long_description = row.long_description;
    if (row.category_code) formatted.category_code = row.category_code;
    if (row.item_type) formatted.item_type = row.item_type;
    if (row.item_code) formatted.item_code = row.item_code;
    if (row.shadow_desc) formatted.shadow_desc = row.shadow_desc;
    if (row.short_description)
      formatted.short_description = row.short_description;
    if (row.level) formatted.level = row.level;
    if (row.valid !== undefined && row.valid !== null) formatted.valid = row.valid;

    return formatted;
  });

  return { data, total: result.total, groupBy };
};

export const getDiagnosis = async (search) => {
  const term = search || "";

  if (term) {
    const query = `
      SELECT user_code as diagnosis_code, description as diagnosis_desc
      FROM code_data
      WHERE code_type = '25'
        AND (LOWER(user_code) ILIKE LOWER(:search) OR LOWER(description) ILIKE LOWER(:search))
      LIMIT 20`;
    return new QueryView(query, { search: `%${term}%` }).execute();
  }

  const query = `
    SELECT user_code as diagnosis_code, description as diagnosis_desc
    FROM code_data
    WHERE code_type = '25'
    LIMIT 100`;
  return new QueryView(query).execute();
};

export const getServices = async (search) => {
  const term = search || "";

  if (term) {
    const query = `
      SELECT item_id, description
      FROM item
      WHERE LOWER(item_id::text) ILIKE LOWER(:search)
         OR LOWER(description) ILIKE LOWER(:search)
      LIMIT 20`;
    return new QueryView(query, { search: `%${term}%` }).execute();
  }

  const query = `SELECT item_id, description FROM item LIMIT 100`;
  return new QueryView(query).execute();
};

export const getValidationCodes = async (search) => {
  const term = search || "";

  if (term) {
    const query = `
      SELECT user_code, description
      FROM code_data
      WHERE code_type = '16'
        AND (LOWER(user_code) ILIKE LOWER(:search) OR LOWER(description) ILIKE LOWER(:search))
      LIMIT 20`;
    return new QueryView(query, { search: `%${term}%` }).execute();
  }

  const query = `
    SELECT user_code, description
    FROM code_data
    WHERE code_type = '16'
    LIMIT 100`;
  return new QueryView(query).execute();
};

export const getPhysicians = async (search) => {
  const term = search || "";

  if (term) {
    const query = `
      SELECT employee_id, employee_no, employee_job, first_name, middle_names, last_name,
             religion_code, date_of_birth, gender, nationality_code, marital_code,
             occupation_code, email, mobile_no, license, main_specilaity,
             notify_by_email, notify_by_sms, notify_by_whatsapp, notify_by_system,
             created_by, creation_date, modified_by, modification_date
      FROM employee
      WHERE LOWER(first_name) ILIKE LOWER(:search)
         OR LOWER(last_name) ILIKE LOWER(:search)
         OR LOWER(employee_no::text) ILIKE LOWER(:search)
         OR LOWER(middle_names) ILIKE LOWER(:search)
      LIMIT 20`;
    return new QueryView(query, { search: `%${term}%` }).execute();
  }

  const query = `
    SELECT employee_id, employee_no, employee_job, first_name, middle_names, last_name,
           religion_code, date_of_birth, gender, nationality_code, marital_code,
           occupation_code, email, mobile_no, license, main_specilaity,
           notify_by_email, notify_by_sms, notify_by_whatsapp, notify_by_system,
           created_by, creation_date, modified_by, modification_date
    FROM employee e
    LIMIT 100`;
  return new QueryView(query).execute();
};

const buildFacilitiesClaimQuery = ({ start_date, end_date }) => {
  const whereClauses = [];
  const params = {};

  if (start_date) {
    whereClauses.push("cv.creation_date >= :start_date");
    params.start_date = start_date;
  } else {
    whereClauses.push("cv.creation_date >= :start_date");
    params.start_date = dayjs().format("YYYY-MM-DD HH:mm:ss");
  }

  if (end_date) {
    whereClauses.push("cv.creation_date < :end_date");
    params.end_date = end_date;
  }

  const query = `
    SELECT
      name as facility_name,
      COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'CLAIM') AS claim,
      COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'PRE-AUTH') AS "pre-auth",
      COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'PRESCRIPTION') AS prescription,
      COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'SERVICES') AS services
    FROM nphies.claim_validation cv
    JOIN nphies.service_request sr
      ON cv.req_id = sr.req_id
    LEFT JOIN rcm.facility f on f.facility_id = sr.facility_id
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY facility_name`;

  return { query, params };
};

export const getFacilitiesClaimData = async ({ start_date, end_date }) => {
  const { query, params } = buildFacilitiesClaimQuery({ start_date, end_date });
  return new QueryView(query, params).execute();
};

export const buildFacilitiesReport = async ({ start_date, end_date, userId }) => {
  const file_extension = "pdf";

  const params = {
    start_date: start_date || dayjs().format("YYYY-MM-DD HH:mm:ss"),
    end_date: end_date || dayjs().format("YYYY-MM-DD HH:mm:ss"),
  };

  const reportQuery = `
    SELECT
      name as facility_name,
      COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'CLAIM') AS claim,
      COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'PRE-AUTH') AS "pre-auth",
      COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'PRESCRIPTION') AS prescription,
      COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'SERVICES') AS services
    FROM nphies.claim_validation cv
    JOIN nphies.service_request sr
      ON cv.req_id = sr.req_id
    LEFT JOIN rcm.facility f on f.facility_id = sr.facility_id
    WHERE cv.creation_date >= :start_date
      AND cv.creation_date < :end_date
    GROUP BY facility_name`;

  const result = await new QueryView(reportQuery, params).execute();

  const headerData = await new QueryView(
    `SELECT conf_key, conf_value, description
       FROM rcm.conf
      WHERE conf_key IN ('HOSPITAL_NAME', 'VAT_REGISTRATION_NO', 'ORG_LOGO_FILENAME')`,
  ).execute();

  const hospitalName =
    headerData.data.find((item) => item.conf_key === "HOSPITAL_NAME")
      ?.conf_value || "";

  const orgImgBase64 = fs
    .readFileSync(path.join(assetsDir, "hnh_logo.png"))
    .toString("base64");
  const sysImgBase64 = fs
    .readFileSync(path.join(assetsDir, "givc_logo.svg"))
    .toString("base64");

  const userData = await new QueryView(
    `SELECT * FROM rcm.user WHERE user_id = :userId`,
    { userId },
  ).execute();

  const user = userData.data[0];
  const userName = user
    ? `${user.first_name ?? ""} ${user.family_name ?? ""}`.trim()
    : "";

  const reportPrintTimeStamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Riyadh",
  });

  await reloadConfByKeys("REPORT_SERVER_URL");

  const confValue = getConf("REPORT_SERVER_URL");
  if (!confValue || confValue.length === 0) {
    throw new Error("REPORT_SERVER_URL not found in configuration");
  }

  const reportServerUrl = confValue.trim().replace(/\/+$/, "");
  const contentType = "application/pdf";

  const response = await fetch(`${reportServerUrl}/api/report/`, {
    method: "POST",
    headers: {
      Accept: contentType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template: {
        name: "nphies-validationDashboard-validationsByFacility-template",
      },
      data: {
        data: result.data,
        orgImgBase64,
        sysImgBase64,
        hospitalName,
        reportPrintTimeStamp,
        userName,
        start_date: params.start_date,
        end_date: params.end_date,
      },
      options: {
        reportType: file_extension,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HTTP error! status: ${response.status}, message: ${errorText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  logger.info(
    `Validation Claims by facility generated successfully as (${file_extension})`,
  );

  return {
    buffer,
    contentType,
    filename: "validation_claims_by_facility.pdf",
  };
};

const buildFilters = (filters, params) => {
  const {
    diagnosis_code,
    physician_emp_id,
    validation_code,
    payer_id,
    status,
  } = filters;

  if (diagnosis_code) {
    params.diagnosis_code = diagnosis_code;
  }
  if (physician_emp_id) {
    params.physician_emp_id = physician_emp_id;
  }
  if (validation_code) {
    params.validation_code = validation_code;
  }
  if (payer_id) {
    params.payer_id = payer_id;
  }
  if (status) {
    params.status = status;
  }
};

const buildCommonWhere = (filters, params, facilityScoped, facilityId) => {
  const { start_date, end_date, diagnosis_code, physician_emp_id, validation_code, payer_id, status } =
    filters;

  const whereClauses = [];

  applyDateRange(whereClauses, params, start_date, end_date);

  if (diagnosis_code) {
    whereClauses.push("LOWER(cv.diagnosis_code) = LOWER(:diagnosis_code)");
  }
  if (physician_emp_id) {
    whereClauses.push("cv.physician_emp_id = :physician_emp_id");
  }
  if (validation_code) {
    whereClauses.push("LOWER(cv.validation_code) = LOWER(:validation_code)");
  }
  if (status) {
    whereClauses.push("LOWER(cv.status) = LOWER(:status)");
  }
  if (payer_id) {
    whereClauses.push("cv.payer_id = :payer_id");
  }
  if (facilityScoped) {
    whereClauses.push("sr.facility_id = :facility_id");
    params.facility_id = facilityId;
  }

  return whereClauses;
};

export const getTypeTimelineData = async ({
  scope,
  filters,
  queryParams,
  facilityId,
}) => {
  const { castingType, format, facilityScoped } = resolveScope(scope);

  const params = {};
  buildFilters(filters, params);

  const whereClauses = buildCommonWhere(
    filters,
    params,
    facilityScoped,
    facilityId,
  );

  let query = `
    SELECT
      to_char(date_trunc('${castingType}', cv.creation_date), '${format}') AS ${castingType},
      COALESCE(COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'CLAIM'), 0) AS claim,
      COALESCE(COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'PRE-AUTH'), 0) AS "pre-auth",
      COALESCE(COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'SERVICES'), 0) AS services,
      COALESCE(COUNT(DISTINCT sr.req_id) FILTER (WHERE sr.req_type = 'PRESCRIPTION'), 0) AS prescription
    FROM service_request sr
    INNER JOIN claim_validation cv
      ON sr.req_id = cv.req_id
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY date_trunc('${castingType}', cv.creation_date)`;

  if (castingType === "hour") {
    query = `
      SELECT
        hourly_data.hour AS hour,
        ROUND(AVG(hourly_data.claim), 2) AS claim,
        ROUND(AVG(hourly_data."pre-auth"), 2) AS "pre-auth",
        ROUND(AVG(hourly_data.services), 2) AS services,
        ROUND(AVG(hourly_data.prescription), 2) AS prescription
      FROM (
        ${query}
      ) hourly_data
      GROUP BY hourly_data.hour
      ORDER BY hourly_data.hour`;
  }

  return executeTimelineQuery(query, params, queryParams);
};

export const getStatusTimelineData = async ({
  scope,
  filters,
  queryParams,
  facilityId,
}) => {
  const { castingType, format, facilityScoped } = resolveScope(scope);

  const params = {};
  buildFilters(filters, params);

  if (filters.req_type) {
    params.req_type = filters.req_type;
  }

  const whereClauses = buildCommonWhere(
    filters,
    params,
    facilityScoped,
    facilityId,
  );

  if (filters.req_type) {
    whereClauses.push("LOWER(sr.req_type) = LOWER(:req_type)");
  }

  let query = `
    SELECT
      to_char(date_trunc('${castingType}', cv.creation_date), '${format}') AS ${castingType},
      COALESCE(COUNT(DISTINCT sr.req_id) FILTER (WHERE cv.status = 'NEW'), 0) AS new,
      COALESCE(COUNT(DISTINCT sr.req_id) FILTER (WHERE cv.status = 'RECHECK'), 0) AS recheck,
      COALESCE(COUNT(DISTINCT sr.req_id) FILTER (WHERE cv.status = 'RESOLVED'), 0) AS resolved,
      COALESCE(COUNT(DISTINCT sr.req_id) FILTER (WHERE cv.status = 'IGNORE'), 0) AS ignore
    FROM service_request sr
    INNER JOIN claim_validation cv
      ON sr.req_id = cv.req_id
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY date_trunc('${castingType}', cv.creation_date)`;

  if (castingType === "hour") {
    query = `
      SELECT
        hourly_data.hour AS hour,
        ROUND(AVG(hourly_data.new), 2) AS new,
        ROUND(AVG(hourly_data.recheck), 2) AS recheck,
        ROUND(AVG(hourly_data.resolved), 2) AS resolved,
        ROUND(AVG(hourly_data.ignore), 2) AS ignore
      FROM (
        ${query}
      ) hourly_data
      GROUP BY hourly_data.hour
      ORDER BY hourly_data.hour`;
  }

  return executeTimelineQuery(query, params, queryParams);
};

const executeTimelineQuery = async (query, params, queryParams) => {
  const queryView = new QueryView(query, params);

  const result =
    queryParams.componentType === "chart"
      ? await queryView.execute()
      : await queryView.apply(queryParams).execute();

  return result;
};
