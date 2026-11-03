import dayjs from "dayjs";
import { QueryView } from "../../utils/queryView.js";
import { query as pgQuery } from "../../config/database.js";
import logger from "../../config/logger.js";






export const searchPayerLookups = async (searchValue, facilityId = null) => {
  const values = [];
  const conditions = [];
  let query = `
    SELECT payer_id, short_name
    FROM rcm.payer
  `;
  if (searchValue) {
    conditions.push(`CONCAT(payer_id::text, ' · ', short_name) ILIKE $1`);
    values.push(`%${searchValue}%`);
  }
  if (facilityId) {
    const idx = values.length + 1;
    conditions.push(`facility_id = $${idx}`);
    values.push(facilityId);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  query += ` ORDER BY short_name ASC LIMIT 10`;
  const res = await pgQuery(query, values);
  return res.rows;
};


export const rejectionByTime = async ({
  date_start,
  date_end,
  payer_id,
  error_code,
  diagnosis_code,
  physician_id,
  service_code,
}) => {
  try {
    const queryParams = [];
    let paramIndex = 1;

    let query = `
            SELECT
                date_trunc('day', ah.response_date)     AS time_bucket,
                COUNT(*)                                AS cnt
            FROM approval_history ah
            WHERE ah.msg_id IS NOT NULL

    `;
    if (date_start) {
      query += ` AND ah.response_date >= $${paramIndex} `;
      queryParams.push(dayjs(date_start).format("YYYY-MM-DD"));
      paramIndex++;
    }

    if (date_end) {
      query += ` AND ah.response_date <= $${paramIndex} `;
      queryParams.push(dayjs(date_end).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (payer_id) {
      query += ` AND ah.payer_id = $${paramIndex} `;
      queryParams.push(payer_id);
      paramIndex++;
    }
    if (error_code) {
      query += ` AND ah.msg_id = $${paramIndex} `;
      queryParams.push(error_code);
      paramIndex++;
    }
    if (diagnosis_code) {
      query += ` AND ah.diagnosis_code = $${paramIndex} `;
      queryParams.push(diagnosis_code);
      paramIndex++;
    }
    if (physician_id) {
      query += ` AND ah.physician_id = $${paramIndex} `;
      queryParams.push(physician_id);
      paramIndex++;
    }
    if (service_code) {
      query += ` AND ah.service_code = $${paramIndex} `;
      queryParams.push(service_code);
      paramIndex++;
    }

    query += `
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        `;
    const result = await pgQuery(query, queryParams);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> rejectionByTime", error);
    throw error;
  }
};

export const topErrors = async ({
  date_start,
  date_end,
  date,
  payer_id,
  error_code,
  diagnosis_code,
  physician_id,
  service_code,
  limit = 10,
}) => {
  try {
    const queryParams = [limit];
    let paramIndex = queryParams.length + 1;

    let query = `
        select 
            ah.msg_id,
            n.description,
            COUNT(*) as cnt
        from approval_history ah
        join nphies_error_code n  on n.error_id = ah.msg_id
        where ah.msg_id is not null
    `;
    if (date_start) {
      query += ` AND ah.response_date >= $${paramIndex} `;
      queryParams.push(dayjs(date_start).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (date_end) {
      query += ` AND ah.response_date <= $${paramIndex} `;
      queryParams.push(dayjs(date_end).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (payer_id) {
      query += ` AND ah.payer_id = $${paramIndex} `;
      queryParams.push(payer_id);
      paramIndex++;
    }
    if (error_code) {
      query += ` AND ah.msg_id = $${paramIndex} `;
      queryParams.push(error_code);
      paramIndex++;
    }
    if (diagnosis_code) {
      query += ` AND ah.diagnosis_code = $${paramIndex} `;
      queryParams.push(diagnosis_code);
      paramIndex++;
    }
    if (physician_id) {
      query += ` AND ah.physician_id = $${paramIndex} `;
      queryParams.push(physician_id);
      paramIndex++;
    }
    if (service_code) {
      query += ` AND ah.service_code = $${paramIndex} `;
      queryParams.push(service_code);
      paramIndex++;
    }

    if (date) {
      query += ` AND date_trunc('day', ah.response_date) = $${paramIndex} `;
      queryParams.push(dayjs(date).format("YYYY-MM-DD"));
      paramIndex++;
    }

    query += `
        group by ah.msg_id, n.description
        order by cnt desc
        limit $1
    `;

    const result = await pgQuery(query, queryParams);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> topErrors", error);
    throw error;
  }
};

export const topPayers = async ({
  date_start,
  date_end,
  payer_id,
  error_code,
  diagnosis_code,
  physician_id,
  service_code,
  limit = 10,
}) => {
  try {
    const queryParams = [limit];
    let paramIndex = queryParams.length + 1;

    let query = `
        select
            ah.payer_id,
            n.short_name,
            COUNT(*) as cnt
        from nphies.approval_history ah
        join rcm.payer n  on n.payer_id = ah.payer_id::int
        where ah.payer_id is not null
    `;
    if (date_start) {
      query += ` AND ah.response_date >= $${paramIndex} `;
      queryParams.push(dayjs(date_start).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (date_end) {
      query += ` AND ah.response_date <= $${paramIndex} `;
      queryParams.push(dayjs(date_end).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (payer_id) {
      query += ` AND ah.payer_id = $${paramIndex} `;
      queryParams.push(payer_id);
      paramIndex++;
    }
    if (error_code) {
      query += ` AND ah.msg_id = $${paramIndex} `;
      queryParams.push(error_code);
      paramIndex++;
    }
    if (diagnosis_code) {
      query += ` AND ah.diagnosis_code = $${paramIndex} `;
      queryParams.push(diagnosis_code);
      paramIndex++;
    }
    if (physician_id) {
      query += ` AND ah.physician_id = $${paramIndex} `;
      queryParams.push(physician_id);
      paramIndex++;
    }
    if (service_code) {
      query += ` AND ah.service_code = $${paramIndex} `;
      queryParams.push(service_code);
      paramIndex++;
    }

    query += ` group by ah.payer_id, n.short_name
        order by cnt desc
        limit $1
        `;

    const result = await pgQuery(query, queryParams);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> topPayers", error);
    throw error;
  }
};

export const topDiagnosis = async ({
  date_start,
  date_end,
  payer_id,
  error_code,
  diagnosis_code,
  physician_id,
  service_code,
  limit = 10,
}) => {
  try {
    const queryParams = [limit];
    let paramIndex = queryParams.length + 1;

    let query = `
        select
            dc.ascii_short_desc,
            COUNT(*) as cnt
        from nphies.approval_history ah
        join rcm.diagnosis_code dc on dc.code_id = ah.diagnosis_code
        where ah.diagnosis_code  is not null
    `;
    if (date_start) {
      query += ` AND ah.response_date >= $${paramIndex} `;
      queryParams.push(dayjs(date_start).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (date_end) {
      query += ` AND ah.response_date <= $${paramIndex} `;
      queryParams.push(dayjs(date_end).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (payer_id) {
      query += ` AND ah.payer_id = $${paramIndex} `;
      queryParams.push(payer_id);
      paramIndex++;
    }
    if (error_code) {
      query += ` AND ah.msg_id = $${paramIndex} `;
      queryParams.push(error_code);
      paramIndex++;
    }
    if (diagnosis_code) {
      query += ` AND ah.diagnosis_code = $${paramIndex} `;
      queryParams.push(diagnosis_code);
      paramIndex++;
    }
    if (physician_id) {
      query += ` AND ah.physician_id = $${paramIndex} `;
      queryParams.push(physician_id);
      paramIndex++;
    }
    if (service_code) {
      query += ` AND ah.service_code = $${paramIndex} `;
      queryParams.push(service_code);
      paramIndex++;
    }
    query += ` group by dc.ascii_short_desc 
        order by cnt desc
        limit $1
        `;

    const result = await pgQuery(query, queryParams);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> topDiagnosis", error);
    throw error;
  }
};

export const topServices = async ({
  date_start,
  date_end,
  payer_id,
  error_code,
  diagnosis_code,
  physician_id,
  service_code,
  limit = 10,
}) => {
  try {
    const queryParams = [limit];
    let paramIndex = queryParams.length + 1;

    let query = `
        select
            ah.item_id,
            i.description,
            COUNT(*) as cnt
        from nphies.approval_history ah
        join item i on i.item_bk = ah.item_id::text
        where ah.status = 'REJECTED' 

    `; // TODO: rejected or is not accepted?
    if (date_start) {
      query += ` AND ah.response_date >= $${paramIndex} `;
      queryParams.push(dayjs(date_start).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (date_end) {
      query += ` AND ah.response_date <= $${paramIndex} `;
      queryParams.push(dayjs(date_end).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (payer_id) {
      query += ` AND ah.payer_id = $${paramIndex} `;
      queryParams.push(payer_id);
      paramIndex++;
    }
    if (error_code) {
      query += ` AND ah.msg_id = $${paramIndex} `;
      queryParams.push(error_code);
      paramIndex++;
    }
    if (diagnosis_code) {
      query += ` AND ah.diagnosis_code = $${paramIndex} `;
      queryParams.push(diagnosis_code);
      paramIndex++;
    }
    if (physician_id) {
      query += ` AND ah.physician_id = $${paramIndex} `;
      queryParams.push(physician_id);
      paramIndex++;
    }
    if (service_code) {
      query += ` AND ah.service_code = $${paramIndex} `;
      queryParams.push(service_code);
      paramIndex++;
    }
    query += `group by ah.item_id, i.description
		order by cnt DESC
        limit $1
        `;

    const result = await pgQuery(query, queryParams);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> topServices", error);
    throw error;
  }
};

export const topPhysicians = async ({
  date_start,
  date_end,
  payer_id,
  error_code,
  diagnosis_code,
  physician_id,
  service_code,
  limit = 10,
}) => {
  try {
    const queryParams = [limit];
    let paramIndex = 2;

    let query = `
        select 
        case 
            when e.employee_no is null then 'OTHER'
            else ah.practitioner_no
        end as practitioner_no,
        case 
            when e.employee_no is null then 'Other/Unknown'
            else e.first_name || ' ' || e.last_name
        end as full_name,
        count(*) as cnt
        from approval_history ah
        left join employee e on e.employee_no::text = ah.practitioner_no
        where ah.status = 'REJECTED'
    `;
    if (date_start) {
      query += ` AND ah.response_date >= $${paramIndex} `;
      queryParams.push(dayjs(date_start).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (date_end) {
      query += ` AND ah.response_date <= $${paramIndex} `;
      queryParams.push(dayjs(date_end).format("YYYY-MM-DD"));
      paramIndex++;
    }
    if (payer_id) {
      query += ` AND ah.payer_id = $${paramIndex} `;
      queryParams.push(payer_id);
      paramIndex++;
    }
    if (error_code) {
      query += ` AND ah.msg_id = $${paramIndex} `;
      queryParams.push(error_code);
      paramIndex++;
    }
    if (diagnosis_code) {
      query += ` AND ah.diagnosis_code = $${paramIndex} `;
      queryParams.push(diagnosis_code);
      paramIndex++;
    }
    if (physician_id) {
      query += ` AND ah.physician_id = $${paramIndex} `;
      queryParams.push(physician_id);
      paramIndex++;
    }
    if (service_code) {
      query += ` AND ah.service_code = $${paramIndex} `;
      queryParams.push(service_code);
      paramIndex++;
    }

    query += `
        group by 
        case when e.employee_no is null then 'OTHER' else ah.practitioner_no end,
        case when e.employee_no is null then 'Other/Unknown' else e.first_name || ' ' || e.last_name end
        order by cnt desc
        limit $1
        `;

    const result = await pgQuery(query, queryParams);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> topPhysicians", error);
    throw error;
  }
};

export const getPayerLookups = async ({ searchValue, facilityId }) => {
  try {
    return await searchPayerLookups(searchValue, facilityId);
  } catch (error) {
    logger.error("error in dashboardModel -> getPayerLookups", error);
    throw error;
  }
};

export const getErrorCodeLookups = async ({ searchValue }) => {
  try {
    const values = [];
    let query = `
      SELECT 
        error_id,
        description
     FROM nphies.nphies_error_code
    `;

    if (searchValue) {
      query += `
        WHERE CONCAT(error_id::text, ' · ', description) ILIKE $1
      `;
      values.push(`%${searchValue}%`);
    }

    query += `
      ORDER BY description ASC
      LIMIT 10;
    `;

    const result = await pgQuery(query, values);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> getErrorCodeLookups", error);
    throw error;
  }
};

export const getDiagnosisCodeLookups = async ({ searchValue }) => {
  try {
    const values = [];
    let query = `
      SELECT 
        code_id,
        ascii_short_desc
      FROM rcm.diagnosis_code
    `;

    if (searchValue) {
      query += `
        WHERE CONCAT(code_id::text, ' · ', ascii_short_desc) ILIKE $1
      `;
      values.push(`%${searchValue}%`);
    }

    query += `
      ORDER BY ascii_short_desc ASC
      LIMIT 10;
    `;

    const result = await pgQuery(query, values);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> getDiagnosisCodeLookups", error);
    throw error;
  }
};

export const getServiceLookups = async ({ searchValue }) => {
  try {
    const values = [];
    let query = `
      SELECT 
        item_bk,
        description
      FROM item
    `;

    if (searchValue) {
      query += `
        WHERE CONCAT(item_bk::text, ' · ', description) ILIKE $1
      `;
      values.push(`%${searchValue}%`);
    }

    query += `
      ORDER BY description ASC
      LIMIT 10;
    `;

    const result = await pgQuery(query, values);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> getServiceLookups", error);
    throw error;
  }
};

export const getPhysicianLookups = async ({ searchValue }) => {
  try {
    const values = [];
    let query = `
      SELECT 
        employee_id,
        employee_no,
        first_name || ' ' || last_name AS full_name
      FROM employee
    `;

    if (searchValue) {
      query += `
        WHERE CONCAT(employee_id::text, ' · ', first_name, ' ', last_name, ' ', employee_no) ILIKE $1
      `;
      values.push(`%${searchValue}%`);
    }

    query += `
      ORDER BY first_name, last_name ASC
      LIMIT 10;
    `;

    const result = await pgQuery(query, values);
    return result.rows;
  } catch (error) {
    logger.error("error in dashboardModel -> getPhysicianLookups", error);
    throw error;
  }
};

const buildKpiFilterClause = (filters = {}) => {
  const {
    date_start,
    date_end,
    payer_id,
    error_code,
    diagnosis_code,
    physician_id,
    service_code,
  } = filters;

  let clause = "";
  const params = [];
  let idx = 1;

  const append = (value, statement, formatter = (val) => val) => {
    if (value === undefined || value === null || value === "") return;
    clause += ` ${statement}$${idx} `;
    params.push(formatter(value));
    idx++;
  };

  append(date_start, "AND ah.response_date >= ", (v) =>
    dayjs(v).format("YYYY-MM-DD"),
  );
  append(date_end, "AND ah.response_date <= ", (v) =>
    dayjs(v).format("YYYY-MM-DD"),
  );
  append(payer_id, "AND ah.payer_id = ");
  append(error_code, "AND ah.msg_id = ");
  append(diagnosis_code, "AND ah.diagnosis_code = ");
  append(physician_id, "AND ah.physician_id = ");
  append(service_code, "AND ah.service_code = ");

  return { clause, params };
};

export const getRejectionCount = async (filters = {}) => {
  try {
    const { clause, params } = buildKpiFilterClause(filters);
    const query = `
            SELECT COUNT(*) AS value
            FROM approval_history ah
            WHERE ah.status = 'REJECTED'
            ${clause}
        `;

    const { rows } = await pgQuery(query, params);
    return rows[0];
  } catch (error) {
    logger.error("error in dashboardModel -> getRejectedCount", error);
    throw error;
  }
};

export const getRejectionAmount = async (filters = {}) => {
  try {
    const { clause, params } = buildKpiFilterClause(filters);
    const query = `
            SELECT COALESCE(SUM(ah.amount), 0) AS value
            FROM approval_history ah
            WHERE ah.status = 'REJECTED'
            ${clause}
        `;

    const { rows } = await pgQuery(query, params);
    return rows[0];
  } catch (error) {
    logger.error("error in dashboardModel -> getRejectedAmount", error);
    throw error;
  }
};

export const getRejectionRate = async (filters = {}) => {
  try {
    const { clause, params } = buildKpiFilterClause(filters);
    const query = `
            SELECT
                ROUND(
                    COALESCE(
                        COUNT(CASE WHEN ah.status = 'REJECTED' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
                        0
                    ),
                    2
                ) AS value
            FROM approval_history ah
            WHERE 1 = 1
            ${clause}
        `;

    const { rows } = await pgQuery(query, params);
    return rows[0];
  } catch (error) {
    logger.error("error in dashboardModel -> getRejectionSummary", error);
    throw error;
  }
};

export const getErrorCodes = async (req) => {
  const {
    date_start,
    date_end,
    payer_id,
    error_code,
    diagnosis_code,
    physician_id,
    service_code,
  } = req.query;
  try {
    let query = `
      SELECT 
            ah.msg_id,
            n.description AS reason,
            COUNT(*) as cnt
        FROM approval_history ah
        LEFT JOIN nphies_error_code n  ON n.error_id = ah.msg_id
        WHERE ah.status IN ('REJECTED', 'PARTIAL')
      `;
    const whereClause = [];
    const queryParams = {};

    if (date_start) {
      whereClause.push(` ah.response_date >= :response_date_start `);
      queryParams.response_date_start = dayjs(date_start).format("YYYY-MM-DD");
    } else {
      whereClause.push(` ah.response_date >= :response_date_start`);
      queryParams.response_date_start = dayjs().format("YYYY-MM-DD");
    }
    if (date_end) {
      whereClause.push(` ah.response_date <= :response_date_end `);
      queryParams.response_date_end = dayjs(date_end).format("YYYY-MM-DD");
    }
    if (payer_id) {
      whereClause.push(` ah.payer_id = :payer_id `);
      queryParams.payer_id = payer_id;
    }
    if (error_code) {
      whereClause.push(` ah.msg_id = :msg_id `);
      queryParams.msg_id = error_code;
    }
    if (diagnosis_code) {
      whereClause.push(` ah.diagnosis_code = :diagnosis_code`);
      queryParams.diagnosis_code = diagnosis_code;
    }
    if (physician_id) {
      whereClause.push(` ah.physician_id = :physician_id `);
      queryParams.physician_id = physician_id;
    }
    if (service_code) {
      whereClause.push(` ah.service_code = :service_code `);
      queryParams.service_code = service_code;
    }
    const whereString =
      whereClause.length > 0 ? " AND " + whereClause.join(" AND ") : "";
    query += whereString;
    query += `
        GROUP BY ah.msg_id, n.description
        ORDER BY cnt desc
    `;
    const result = await new QueryView(query, queryParams)
      .apply(req.query)
      .execute();
    return result;
  } catch (error) {
    logger.error("error in dashboardModel -> getErrorCodes", error);
    throw error;
  }
};

export const getClaims = async (req) => {
  try {
    const {
      date_start,
      date_end,
      payer_id,
      diagnosis_code,
      physician_id,
      service_code,
      msg_id,
    } = req.query;
    let query = `
            SELECT
                ah.claim_invoice_no,
                ah.chief_complaint,
                ah.billable_period_end,
                ah.specialty,
                ah.treatment_type,
                ah.treatment_sub_type,
                ah.age,
                ah.gender,
                e.first_name || ' ' || e.middle_names || ' ' || e.last_name AS practitioner,
                py.description AS payer,
                STRING_AGG(DISTINCT ah.diagnosis_code, ', ') AS diagnosis_codes,
                p.first_name || ' ' || p.middle_names || ' ' || p.last_name AS patient,
                STRING_AGG(DISTINCT ah.reason, ', ') AS reason
            FROM nphies.approval_history ah
            LEFT JOIN rcm.payer py
                ON ah.payer_id = py.payer_id::text
            LEFT JOIN rcm.patient p
                ON ah.patient_id = p.patient_id::text
            LEFT JOIN rcm.employee e
                ON ah.practitioner_no = e.employee_no
            LEFT JOIN nphies.nphies_error_code n
                ON n.error_id = ah.msg_id
            Where ah.msg_id = :msg_id
    `;
    const queryParams = {};
    queryParams.msg_id = msg_id;
    const whereClause = [];
    if (date_start) {
      whereClause.push(` ah.response_date >= :response_date_start `);
      queryParams.response_date_start = dayjs(date_start).format("YYYY-MM-DD");
    } else {
      whereClause.push(` ah.response_date >= :response_date_start`);
      queryParams.response_date_start = dayjs().format("YYYY-MM-DD");
    }
    if (date_end) {
      whereClause.push(` ah.response_date <= :response_date_end `);
      queryParams.response_date_end = dayjs(date_end).format("YYYY-MM-DD");
    }
    if (payer_id) {
      whereClause.push(` ah.payer_id = :payer_id `);
      queryParams.payer_id = payer_id;
    }
    if (diagnosis_code) {
      whereClause.push(` ah.diagnosis_code = :diagnosis_code`);
      queryParams.diagnosis_code = diagnosis_code;
    }
    if (physician_id) {
      whereClause.push(` ah.physician_id = :physician_id `);
      queryParams.physician_id = physician_id;
    }
    if (service_code) {
      whereClause.push(` ah.service_code = :service_code `);
      queryParams.service_code = service_code;
    }
    const whereString =
      whereClause.length > 0 ? " AND " + whereClause.join(" AND ") : "";
    query += whereString;
    query += `
            GROUP BY
                ah.claim_invoice_no,
                ah.chief_complaint,
                ah.billable_period_end,
                ah.specialty,
                ah.treatment_type,
                ah.treatment_sub_type,
                ah.age,
                ah.gender,
                e.first_name || ' ' || e.middle_names || ' ' || e.last_name ,
                py.description ,
                ah.diagnosis_code ,
                p.first_name || ' ' || p.middle_names || ' ' || p.last_name 
    `;

    const result = await new QueryView(query, queryParams)
      .apply(req.query)
      .execute();
    return result;
  } catch (error) {
    logger.error("error in dashboardModel -> getClaims", error);
    throw error;
  }
};

export const getServices = async (req) => {
  const {
    date_start,
    date_end,
    payer_id,
    diagnosis_code,
    physician_id,
    service_code,
    claim_invoice_no,
    msg_id,
  } = req.query;
  try {
    let query = `
            SELECT 
              ah.id,
              ah.service_code,
              ah.status,
              ah.amount,
              ah.approved_quantity,
              i.description AS item_descirption,
              ah.msg_id
            FROM nphies.approval_history AS ah
            LEFT JOIN rcm.item AS i
            ON ah.item_bk = i.item_bk
            WHERE ah.claim_invoice_no = :claim_invoice_no
            AND ah.msg_id = :msg_id
    `;
    const queryParams = {};
    queryParams.msg_id = msg_id;
    queryParams.claim_invoice_no = claim_invoice_no;
    const whereClause = [];
    if (date_start) {
      whereClause.push(` ah.response_date >= :response_date_start `);
      queryParams.response_date_start = dayjs(date_start).format("YYYY-MM-DD");
    } else {
      whereClause.push(` ah.response_date >= :response_date_start`);
      queryParams.response_date_start = dayjs().format("YYYY-MM-DD");
    }
    if (date_end) {
      whereClause.push(` ah.response_date <= :response_date_end `);
      queryParams.response_date_end = dayjs(date_end).format("YYYY-MM-DD");
    }
    if (payer_id) {
      whereClause.push(` ah.payer_id = :payer_id `);
      queryParams.payer_id = payer_id;
    }

    if (diagnosis_code) {
      whereClause.push(` ah.diagnosis_code = :diagnosis_code`);
      queryParams.diagnosis_code = diagnosis_code;
    }
    if (physician_id) {
      whereClause.push(` ah.physician_id = :physician_id `);
      queryParams.physician_id = physician_id;
    }
    if (service_code) {
      whereClause.push(` ah.service_code = :service_code `);
      queryParams.service_code = service_code;
    }
    const whereString =
      whereClause.length > 0 ? " AND " + whereClause.join(" AND ") : "";
    query += whereString;

    const result = await new QueryView(query, queryParams)
      .apply(req.query)
      .execute();
    return result;
  } catch (error) {
    logger.error("error in dashboardModel -> getServices", error);
    throw error;
  }
};
