import { query } from "../../config/database.js";
import { getConf } from "../../config/conf.js";
import logger from "../../config/logger.js";

/**
 * Builds a robust WHERE clause and parameter list for api_transaction queries.
 * @param {Object} filters
 * @param {number} startIndex - 1-based parameter offset ($startIndex)
 * @returns {{ whereClause: string, values: any[] }}
 */
export const buildTransactionWhereClause = (filters = {}, startIndex = 1) => {
  const conditions = [];
  const values = [];

  const addParam = (val) => {
    values.push(val);
    return `$${startIndex + values.length - 1}`;
  };

  // 1. Direct ID overrides
  if (filters.trans_id) {
    const p = addParam(filters.trans_id);
    conditions.push(`a.api_trans_id = ${p}`);
    return {
      whereClause: `WHERE ${conditions.join(" AND ")}`,
      values,
    };
  }

  if (filters.bundle_id) {
    const p = addParam(filters.bundle_id);
    conditions.push(`a.bundle_id = ${p}`);
    return {
      whereClause: `WHERE ${conditions.join(" AND ")}`,
      values,
    };
  }

  // 2. Date filters (Preserving exact date conversion logic)
  if (filters.date_start) {
    const p = addParam(filters.date_start);
    conditions.push(`a.creation_date >= TO_TIMESTAMP(${p}, 'YYYY-MM-DD HH24:MI')`);
  }

  if (filters.date_end) {
    const p = addParam(filters.date_end);
    conditions.push(
      `a.creation_date < COALESCE(TO_TIMESTAMP(${p}, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp)`,
    );
  }

  // 3. Facility scoping
  if (Array.isArray(filters.facilityIds) && filters.facilityIds.length > 0) {
    const p = addParam(filters.facilityIds);
    conditions.push(`a.facility_id = ANY(${p}::int[])`);
  }

  // 4. Payer filter (handles regular payer_id and non-payer transactions with -1 or NULL)
  if (
    filters.payer_id !== undefined &&
    filters.payer_id !== null &&
    filters.payer_id !== ""
  ) {
    const p = addParam(filters.payer_id);
    conditions.push(
      `(a.payer_id = ${p}::int OR (${p}::int = -1 AND a.payer_id IS NULL))`,
    );
  }

  // 5. String filters (trimmed and case-insensitive, handling CHAR(n) padding and space/underscore variations)
  if (filters.api_name) {
    const p = addParam(filters.api_name);
    conditions.push(`TRIM(UPPER(a.api_name)) = TRIM(UPPER(${p}))`);
  }

  if (filters.api_function) {
    const p = addParam(filters.api_function);
    conditions.push(
      `REPLACE(TRIM(UPPER(a.api_function)), ' ', '_') = REPLACE(TRIM(UPPER(${p})), ' ', '_')`,
    );
  }

  if (filters.api_provider) {
    const p = addParam(filters.api_provider);
    conditions.push(`TRIM(UPPER(a.api_provider)) = TRIM(UPPER(${p}))`);
  }

  const statusVal = filters.status || filters.transaction_status;
  if (statusVal) {
    const p = addParam(statusVal);
    conditions.push(`TRIM(UPPER(a.status)) = TRIM(UPPER(${p}))`);
  }

  if (filters.patient_id) {
    const p = addParam(filters.patient_id);
    conditions.push(`a.patient_id = ${p}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  logger.debug(`buildTransactionWhereClause: ${whereClause}`);
  return { whereClause, values };
};

/**
 * Step 1: Payers Table - Aggregates transaction counts and average response times by payer.
 */
export const getPayers = async ({
  page = 1,
  limit = 10,
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
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

  // Build where clause starting at parameter $3 ($1 is limit, $2 is offset)
  const { whereClause: baseWhere, values } = buildTransactionWhereClause(
    {
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
    },
    3,
  );

  const whereClause = baseWhere
    ? `${baseWhere} AND a.payer_id IS NOT NULL`
    : `WHERE a.payer_id IS NOT NULL`;

  const result = await query(
    `SELECT a.payer_id
          ,p.short_name AS payer_name
          ,COUNT(*) AS cnt
          ,ROUND(AVG(a.response_time_ms)) AS response_ms
          ,COUNT(*) OVER() AS total_rows
     FROM api_transaction a
     LEFT OUTER JOIN rcm.payer p ON a.payer_id = p.payer_id
     ${whereClause}
     GROUP BY a.payer_id, p.short_name
     ORDER BY cnt DESC, a.payer_id ASC
     LIMIT $1 OFFSET $2;`,
    [limitNum, offset, ...values],
  );

  const totalRows = parseInt(result.rows[0]?.total_rows || "0", 10);
  const totalPages = Math.ceil(totalRows / limitNum) || 1;

  return {
    page: pageNum,
    limit: limitNum,
    totalRows,
    totalPages,
    data: result.rows,
  };
};

/**
 * Step 2: Summary Table - Aggregates transaction summaries by api_name, api_function, and status for a payer.
 */
export const getTransSummary = async ({
  page = 1,
  limit = 10,
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
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

  // Build where clause starting at parameter $4 ($1=limit, $2=offset, $3=TIMESTAMP_FORMAT)
  const { whereClause, values } = buildTransactionWhereClause(
    {
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
    },
    4,
  );

  const timestampFormat = getConf("TIMESTAMP_FORMAT") || "DD-MM-YYYY";

  const result = await query(
    `SELECT 
      a.api_name, 
      a.api_function,
      a.status,
      COUNT(*) AS trans_count,
      TO_CHAR(MIN(a.creation_date), $3) AS earliest_trans,
      EXTRACT(EPOCH FROM MIN(a.creation_date)) AS earliest_trans_ts,
      TO_CHAR(MAX(a.creation_date), $3) AS latest_trans,
      EXTRACT(EPOCH FROM MAX(a.creation_date)) AS latest_trans_ts,
      ROUND(AVG(a.response_time_ms)) AS response_ms,
      COUNT(*) OVER() AS total_rows,
      AVG(a.preprocess_time_ms) AS preprocess_t_ms,
      AVG(a.elapsed_time_ms) AS elapsed_t_ms
    FROM api_transaction a
    ${whereClause}
    GROUP BY 
      a.api_name,
      a.api_function,
      a.status
    ORDER BY earliest_trans_ts DESC 
    LIMIT $1 OFFSET $2;`,
    [limitNum, offset, timestampFormat, ...values],
  );

  const totalRows = parseInt(result.rows[0]?.total_rows || "0", 10);
  const totalPages = Math.ceil(totalRows / limitNum) || 1;

  return {
    page: pageNum,
    limit: limitNum,
    totalRows,
    totalPages,
    data: result.rows,
  };
};

/**
 * Step 3: Details Table - Detailed transaction records for a selected summary & payer.
 */
export const getTransDetails = async ({
  page = 1,
  limit = 10,
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
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

  // Build where clause starting at parameter $4 ($1=limit, $2=offset, $3=TIMESTAMP_FORMAT)
  const { whereClause, values } = buildTransactionWhereClause(
    {
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
    },
    4,
  );

  const timestampFormat = getConf("TIMESTAMP_FORMAT") || "DD-MM-YYYY";

  const result = await query(
    `SELECT 
      a.api_trans_id,
      a.api_name,
      a.transaction_id,
      a.api_function,
      a.facility_id,
      a.creation_date AS date,
      TO_CHAR(a.creation_date, $3) AS creation_date,
      EXTRACT(EPOCH FROM a.creation_date) AS creation_date_ts,
      a.response_time_ms,
      a.elapsed_time_ms,
      a.preprocess_time_ms,
      a.local_api_time_ms,
      a.status,
      a.outcome,
      a.url,
      a.adjudication_outcome,
      a.patient_id,
      a.payer_id,
      a.error_message,
      a.cancel_api_trans_id,
      a.bundle_id,
      a.episode_no,
      TO_CHAR(a.trans_date, $3) AS trans_date,
      a.dest_url,
      LENGTH(a.request) / 1024 AS req_kb,
      LENGTH(a.response) / 1024 AS res_kb,
      a.bundle_count,
      COUNT(*) OVER() AS total_rows
    FROM api_transaction a
    ${whereClause}
    ORDER BY date DESC
    LIMIT $1 OFFSET $2;`,
    [limitNum, offset, timestampFormat, ...values],
  );

  const totalRows = parseInt(result.rows[0]?.total_rows || "0", 10);
  const totalPages = Math.ceil(totalRows / limitNum) || 1;

  return {
    page: pageNum,
    limit: limitNum,
    totalRows,
    totalPages,
    data: result.rows,
  };
};

export const getTransErrors = async (
  p_trans_id = null,
  page = 1,
  limit = 10,
) => {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

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
    p_trans_id ? [p_trans_id, limitNum, offset] : [limitNum, offset],
  );

  const countResult = await query(
    `SELECT COUNT(*) AS total
     FROM api_message
     ${p_trans_id ? `WHERE api_trans_id = $1` : ``};`,
    p_trans_id ? [p_trans_id] : [],
  );

  const totalRows = parseInt(countResult.rows[0]?.total || "0", 10);
  const totalPages = Math.ceil(totalRows / limitNum) || 1;

  return {
    data: result.rows,
    totalRows,
    totalPages,
    currentPage: pageNum,
    limit: limitNum,
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
    ORDER BY api_trans_id, response_seq 
    LIMIT 10;`,
    values,
  );

  return { data: result.rows };
};

export const getPollDetails = async (
  p_about_trans_id = null,
  page = 1,
  limit = 10,
) => {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

  const values = [];
  let whereClause = "";

  if (p_about_trans_id) {
    whereClause = "WHERE prd.api_trans_id = $1";
    values.push(p_about_trans_id);
  }

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
  const dataResult = await query(dataQuery, [...values, limitNum, offset]);

  const countQuery = `
    SELECT COUNT(*) AS count
    FROM nphies.poll_response_detail prd
    ${whereClause};
  `;
  const countResult = await query(countQuery, values);
  const totalRows = parseInt(countResult.rows[0]?.count || "0", 10);
  const totalPages = Math.ceil(totalRows / limitNum) || 1;

  return {
    data: dataResult.rows,
    totalRows,
    totalPages,
    currentPage: pageNum,
    limit: limitNum,
  };
};
