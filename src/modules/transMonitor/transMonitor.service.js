import { query } from "../../config/database.js";
import { getConf } from "../../config/conf.js";
import logger from "../../config/logger.js";

export const getPayers = async ({
  page,
  limit,
  date_start,
  date_end,
  payer_id,
  api_name,
  api_function,
  status,
  trans_id,
  bundle_id,
  api_provider,
  transaction_status,
  facilityIds,
}) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 10;
  const offset = (page - 1) * limit;
  // Special condition handling
  if (trans_id) bundle_id = null;

  if (trans_id || bundle_id) {
    date_start = "0001-01-01 00:00";
    date_end = "9999-01-01 00:00";
    payer_id = null;
    api_name = null;
    api_function = null;
    status = null;
  }

  const fieldsObj = {
    date_start,
    date_end,
    payer_id,
    api_name,
    api_function,
    status,
    api_trans_id: trans_id,
    bundle_id,
    api_provider,
    transaction_status,
  };

  // Now fetch paginated data
  const { whereStatement: ws2, values: vals2 } = buildSummaryWhereClause(
    fieldsObj,
    2,
  );

  // Facility scoping (only when facility ids are resolved)
  let facilityFilter = "";
  const facilityValues = [];
  if (facilityIds && facilityIds.length > 0) {
    const facilityParamIndex = 3 + vals2.length;
    facilityFilter = `${ws2 ? " AND" : " WHERE a.payer_id IS NOT NULL AND"} a.facility_id = ANY($${facilityParamIndex}::int[])`;
    facilityValues.push(facilityIds);
  }

  const result = await query(
    `SELECT a.payer_id
          ,p.short_name AS payer_name
          ,COUNT(*) AS cnt
          ,ROUND(AVG(response_time_ms)) AS response_ms
          ,COUNT(*) OVER() AS total_rows
     FROM api_transaction a
     LEFT OUTER JOIN rcm.payer p ON a.payer_id = p.payer_id
     ${ws2}${facilityFilter}
     GROUP BY a.payer_id, p.short_name
     LIMIT $1 OFFSET $2;`,
    [limit, offset, ...vals2, ...facilityValues],
  );

  const totalRows = parseInt(result.rows[0]?.total_rows || "0", 10);
  const totalPages = Math.ceil(totalRows / limit) || 1;

  return {
    page,
    limit,
    totalRows,
    totalPages,
    data: result.rows,
  };
};

export const getTransSummary = async ({
  page,
  limit,
  date_start,
  date_end,
  payer_id,
  api_name,
  api_function,
  status,
  trans_id,
  bundle_id,
  api_provider,
  patient_id,
  transaction_status,
  facilityIds,
}) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 10;
  const offset = (page - 1) * limit;

  if (trans_id) bundle_id = null;

  if (trans_id || bundle_id) {
    date_start = "0001-01-01 00:00";
    date_end = "9999-01-01 00:00";

    api_name = null;
    api_function = null;
    status = null;
  }

  const fieldsObj = {
    date_start,
    date_end,
    payer_id,
    api_name,
    api_function,
    status,
    api_trans_id: trans_id,
    bundle_id,
    api_provider,
    patient_id,
    transaction_status,
  };

  if (facilityIds && facilityIds.length > 0)
    fieldsObj.facility_id = facilityIds;

  const whereResult = buildSummaryWhereClause(fieldsObj, 3);
  //Average Preprocess Time
  // Average Elapsed Time

  const result = await query(
    `SELECT 
  api_name, 
  api_function,
  status,
  COUNT(*) AS trans_count,
  TO_CHAR(MIN(a.creation_date), $3) AS earliest_trans,
  EXTRACT(EPOCH FROM MIN(a.creation_date)) AS earliest_trans_ts,
  TO_CHAR(MAX(a.creation_date), $3) AS latest_trans,
  EXTRACT(EPOCH FROM MAX(a.creation_date)) AS latest_trans_ts,
  ROUND(AVG(response_time_ms)) AS response_ms,
  COUNT(*) OVER() AS total_rows,
  AVG(preprocess_time_ms) as preprocess_t_ms,
  AVG(elapsed_time_ms) as elapsed_t_ms
FROM api_transaction a
${whereResult.whereStatement}
GROUP BY 
  api_name,
  api_function,
  status
      ORDER BY earliest_trans_ts DESC 
LIMIT $1 OFFSET $2`,
    [
      limit,
      offset,
      getConf("TIMESTAMP_FORMAT") || "DD-MM-YYYY",
      ...whereResult.values,
    ],
  );
  const totalRows = parseInt(result.rows[0]?.total_rows || "0", 10);

  const totalPages = Math.ceil(totalRows / limit);
  const data = result.rows;

  return { page, limit, totalRows, totalPages, data };
};

export const getTransDetails = async ({
  page,
  limit,
  date_start,
  date_end,
  payer_id,
  api_name,
  api_function,
  status,
  trans_id,
  bundle_id,
  api_provider,
  patient_id,
  transaction_status,
  facilityIds,
}) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 10;
  const offset = (page - 1) * limit;

  if (trans_id) bundle_id = null;

  if (trans_id || bundle_id) {
    date_start = "0001-01-01 00:00";
    date_end = "9999-01-01 00:00";
    payer_id = null;
    api_name = null;
    api_function = null;
    status = null;
  }

  const fieldsObj = {
    date_start,
    date_end,
    payer_id,
    api_name,
    api_function,
    status,
    api_trans_id: trans_id,
    bundle_id,
    api_provider,
    patient_id,
    transaction_status,
  };

  if (facilityIds && facilityIds.length > 0)
    fieldsObj.facility_id = facilityIds;

  const whereResult = buildDetailsWhereClause(fieldsObj, 3);

  const result = await query(
    `SELECT 
      api_trans_id,
      api_name,
      transaction_id,
      api_function,
      facility_id,
      creation_date AS date,
      TO_CHAR(creation_date, $3) AS creation_date,
      EXTRACT(EPOCH FROM creation_date) AS creation_date_ts,
      response_time_ms,
      elapsed_time_ms,
      preprocess_time_ms,
      local_api_time_ms,
      status,
      outcome,
      url,
      adjudication_outcome,
      patient_id,
      payer_id,
      error_message,
      cancel_api_trans_id,
      transaction_id,
      bundle_id,
        episode_no,
        TO_CHAR(trans_date, $3) AS trans_date,
    

      dest_url,
      LENGTH(request) / 1024 AS req_kb,
      LENGTH(response) / 1024 AS res_kb,
      bundle_count,
      COUNT(*) OVER() AS total_rows
    FROM api_transaction a
    ${whereResult.whereStatement}
    ORDER BY date DESC
    LIMIT $1 OFFSET $2 ;`,
    [
      limit,
      offset,
      getConf("TIMESTAMP_FORMAT") || "DD-MM-YYYY",
      ...whereResult.values,
    ],
  );

  const totalRows = parseInt(result.rows[0]?.total_rows || "0", 10);
  const totalPages = Math.ceil(totalRows / limit);

  const data = result.rows;

  return {
    page,
    limit,
    totalRows,
    totalPages,
    data,
  };
};

export const getTransErrors = async (
  p_trans_id = null,
  page = 1,
  limit = 10,
) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 10;
  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT 
        message_id,
        api_trans_id,
        nphies_message_id,
        nphies_message,
        error_element,
        element_value,
        item_no,
        response_id
     FROM api_message
     ${p_trans_id ? `WHERE api_trans_id = $1` : ``}
     ORDER BY message_id 
     LIMIT $${p_trans_id ? 2 : 1} OFFSET $${p_trans_id ? 3 : 2};`,
    p_trans_id ? [p_trans_id, limit, offset] : [limit, offset],
  );

  // Get total count for pagination
  const countResult = await query(
    `SELECT COUNT(*) AS total
     FROM api_message
     ${p_trans_id ? `WHERE api_trans_id = $1` : ``};`,
    p_trans_id ? [p_trans_id] : [],
  );

  const totalRows = parseInt(countResult.rows[0].total, 10);
  const totalPages = Math.ceil(totalRows / limit);

  return {
    data: result.rows,
    totalRows,
    totalPages,
    currentPage: page,
    limit,
  };
};

export const getTransResponses = async (p_trans_id = null) => {
  const values = [];
  if (p_trans_id) values.push(p_trans_id);

  const result = await query(
    `SELECT
       api_trans_id,
       response_id,
       response_seq,
       response_type,
       status,
       error_message,
       response_bundle,
       about_api_trans_id,
       creation_date
    FROM nphies.poll_response_detail prd
    ${!values.length ? `` : `WHERE about_api_trans_id = $1`}
    order by api_trans_id ,response_seq LIMIT 10
    ;`,
    values,
  );

  return { data: result.rows };
};

export const getPollDetails = async (
  p_about_trans_id = null,
  page = 1,
  limit = 10,
) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 10;
  const offset = (page - 1) * limit;

  const values = [];
  let whereClause = "";

  // Optional filtering by transaction ID
  if (p_about_trans_id) {
    whereClause = "WHERE prd.api_trans_id = $1";
    values.push(p_about_trans_id);
  }

  // 1. Fetch paginated poll details
  const dataQuery = `
    SELECT
       response_seq,
       response_type,
       api_trans_id,
       status,
       response_id,
       about_api_trans_id,
       adjudication_outcome,
       creation_date,
       error_message,
       response_bundle
    FROM nphies.poll_response_detail prd
    ${whereClause}
    ORDER BY response_seq
    LIMIT $${values.length + 1} OFFSET $${values.length + 2};
  `;
  const dataResult = await query(dataQuery, [...values, limit, offset]);

  // 2. Get total count
  const countQuery = `
    SELECT COUNT(*) AS count
    FROM nphies.poll_response_detail prd
    ${whereClause};
  `;
  const countResult = await query(countQuery, values);
  const totalRows = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalRows / limit);

  // 3. Return a consistent pagination structure
  return {
    data: dataResult.rows,
    totalRows,
    totalPages,
    currentPage: page,
    limit,
  };
};

const buildSummaryWhereClause = (fields, addToIndx = 0) => {
  const keys = Object.keys(fields).filter(
    (key) =>
      fields[key] !== null &&
      fields[key] !== undefined &&
      fields[key] !== "" &&
      fields[key] !== "null" &&
      fields[key] !== "undefined",
  );

  let whereStatement = "";
  const values = [];

  if (keys.length > 0) {
    whereStatement += "WHERE ";
    const conditions = [`a.api_trans_id IS NOT NULL`];

    keys.forEach((key, idx) => {
      const index = idx + addToIndx + 1;
      values.push(fields[key]);

      if (key === "date_start") {
        conditions.push(
          `a.creation_date >= TO_TIMESTAMP($${index}, 'YYYY-MM-DD HH24:MI')`,
        );
      } else if (key === "date_end") {
        conditions.push(
          `a.creation_date < COALESCE(TO_TIMESTAMP($${index}, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp)`,
        );
      } else if (key === "facility_id") {
        conditions.push(`a.facility_id = ANY($${index}::int[])`);
      } else if (key === "payer_id") {
        conditions.push(
          `(a.payer_id = $${index}::int OR ($${index}::int = -1 AND a.payer_id IS NULL))`,
        );
      } else if (key === "api_name") {
        conditions.push(
          `TRIM(UPPER(a.${key})) = TRIM(UPPER($${index}))`,
        );
      } else if (key === "api_function") {
        conditions.push(
          `REPLACE(TRIM(UPPER(a.${key})), ' ', '_') = REPLACE(TRIM(UPPER($${index})), ' ', '_')`,
        );
      } else if (key === "api_provider") {
        conditions.push(
          `TRIM(UPPER(a.${key})) = TRIM(UPPER($${index}))`,
        );
      } else if (key === "transaction_status" || key === "status") {
        conditions.push(
          `TRIM(UPPER(a.status)) = TRIM(UPPER($${index}))`,
        );
      } else {
        conditions.push(`a.${key} = $${index}`);
      }
    });

    whereStatement += conditions.join(" AND ");
  }

  logger.debug(`whereStatement:${whereStatement}`);
  return { whereStatement, values };
};

const buildDetailsWhereClause = (fields, addToIndx = 0) => {
  const keys = Object.keys(fields).filter(
    (key) =>
      fields[key] !== null &&
      fields[key] !== undefined &&
      fields[key] !== "" &&
      fields[key] !== "null" &&
      fields[key] !== "undefined",
  );

  let whereStatement = "";
  const values = [];

  if (keys.length > 0) {
    const conditions = [`a.api_trans_id IS NOT NULL`];

    keys.forEach((key, idx) => {
      const index = idx + addToIndx + 1;
      values.push(fields[key]);

      if (key === "date_start") {
        conditions.push(
          `a.creation_date >= TO_TIMESTAMP($${index}, 'YYYY-MM-DD HH24:MI')`,
        );
      } else if (key === "date_end") {
        conditions.push(
          `a.creation_date < COALESCE(TO_TIMESTAMP($${index}, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp)`,
        );
      } else if (key === "facility_id") {
        conditions.push(`a.facility_id = ANY($${index}::int[])`);
      } else if (key === "status" || key === "transaction_status") {
        conditions.push(
          `TRIM(UPPER(a.status)) = TRIM(UPPER($${index}))`,
        );
      } else if (key === "payer_id") {
        conditions.push(
          `(a.payer_id = $${index}::int OR ($${index}::int = -1 AND a.payer_id IS NULL))`,
        );
      } else if (key === "api_name") {
        conditions.push(
          `TRIM(UPPER(a.${key})) = TRIM(UPPER($${index}))`,
        );
      } else if (key === "api_function") {
        conditions.push(
          `REPLACE(TRIM(UPPER(a.${key})), ' ', '_') = REPLACE(TRIM(UPPER($${index})), ' ', '_')`,
        );
      } else if (key === "api_provider") {
        conditions.push(
          `TRIM(UPPER(a.${key})) = TRIM(UPPER($${index}))`,
        );
      } else {
        conditions.push(`a.${key} = $${index}`);
      }
    });

    whereStatement = "WHERE " + conditions.join(" AND ");
  }

  logger.debug(`whereStatement:${whereStatement}`);
  return { whereStatement, values };
};
