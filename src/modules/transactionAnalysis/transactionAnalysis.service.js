import dayjs from "../../utils/dayjs.js";
import { formatRiyadhTimestamp } from "../../utils/datetime.js";
import { query } from "../../config/database.js";
import { getConf } from "../../config/conf.js";
import { QueryView } from "../../utils/queryView.js";
import logger from "../../config/logger.js";
import { getPagination } from "../../utils/pagination.js";

const DEFAULT_DATE_FORMAT = "DD-MM-YYYY";

const getTimestampFormat = () =>
  getConf("TIMESTAMP_FORMAT") || DEFAULT_DATE_FORMAT;

const getDateFormat = () => getConf("DATE_FORMAT") || DEFAULT_DATE_FORMAT;

const buildPaginatedResult = (
  result,
  pageNum,
  limitNum,
  data = result.data,
) => ({
  data,
  total: result.total,
  totalPages: Math.ceil((result.total || 0) / limitNum),
  currentPage: pageNum,
  limit: limitNum,
});

const buildMessagesResult = (data, totalRows, pageNum, limitNum) => ({
  data,
  totalRows,
  totalPages: Math.ceil((totalRows || 0) / limitNum),
  currentPage: pageNum,
  limit: limitNum,
});

const pivotTimeBucketsByApi = (rows, displayField) => {
  const apiNames = [...new Set(rows.map((row) => row.api_name))].sort();
  const buckets = new Map();

  rows.forEach((row) => {
    const bucketKey = String(row.bucket);
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        bucket: row.bucket,
        bucket_sort: Number(row.bucket_sort) || 0,
        total: 0,
        response_sum: 0,
        response_count: 0,
        local_sum: 0,
        local_count: 0,
        succeeded: 0,
        counts: {},
      });
    }

    const bucket = buckets.get(bucketKey);
    const apiTotal = Number(row.api_total) || 0;
    bucket.total += apiTotal;
    bucket.response_sum += Number(row.response_sum) || 0;
    bucket.response_count += Number(row.response_count) || 0;
    bucket.local_sum += Number(row.local_sum) || 0;
    bucket.local_count += Number(row.local_count) || 0;
    bucket.succeeded += Number(row.succeeded_count) || 0;
    bucket.counts[row.api_name] = apiTotal;
  });

  const data = [...buckets.values()]
    .sort((first, second) => first.bucket_sort - second.bucket_sort)
    .map((bucket) => {
      const point = {
        [displayField]: bucket.bucket,
        bucket_sort: bucket.bucket_sort,
        total: bucket.total,
        time_s: bucket.response_count
          ? Number(
              (bucket.response_sum / bucket.response_count / 1000).toFixed(1),
            )
          : 0,
        local_time_s: bucket.local_count
          ? Number((bucket.local_sum / bucket.local_count / 1000).toFixed(1))
          : 0,
        "Succeded%": bucket.total
          ? Math.round((bucket.succeeded / bucket.total) * 100)
          : 0,
      };

      apiNames.forEach((apiName) => {
        const count = bucket.counts[apiName] || 0;
        point[`${apiName} Count`] = count;
        point[`${apiName} %`] = bucket.total
          ? Number(((count / bucket.total) * 100).toFixed(2))
          : 0;
      });

      return point;
    });

  return { data, total: data.length, apiNames };
};

export const getApiSummaryReport = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
  } = filters;

  try {
    const params = {
      p1: startDate || null,
      p2: endDate || null,
      p3: payerId ? Number(payerId) : null,
      p4: apiName || null,
      p5: apiProvider || null,
      p6: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      p7: apiFunction || null,
      p8: status || null,
    };

    const baseQuery = `SELECT
      a.api_name,
      UPPER(NULLIF(TRIM(a.status), '')) AS status,
      COUNT(*)::int AS total,
      COALESCE(SUM(a.response_time_ms), 0)::float AS response_sum,
      COUNT(a.response_time_ms)::int AS response_count,
      COALESCE(SUM(a.local_api_time_ms), 0)::float AS local_sum,
      COUNT(a.local_api_time_ms)::int AS local_count,
      COALESCE(SUM(a.preprocess_time_ms), 0)::float AS preprocess_sum,
      COUNT(a.preprocess_time_ms)::int AS preprocess_count
    FROM api_transaction a
    WHERE a.payer_id IS NOT NULL
      AND (:p1::text IS NULL OR a.creation_date >= TO_TIMESTAMP(:p1, 'YYYY-MM-DD HH24:MI'))
      AND (:p2::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND (:p3::bigint IS NULL OR a.payer_id = :p3::bigint)
      AND (:p4::text IS NULL OR UPPER(a.api_name) = UPPER(:p4::text))
      AND (:p5::text IS NULL OR UPPER(a.api_provider) = UPPER(:p5::text))
      AND a.facility_id IN (:p6)
      AND (:p7::text IS NULL OR UPPER(a.api_function) = UPPER(:p7::text))
      AND (:p8::text IS NULL OR UPPER(NULLIF(TRIM(a.status), '')) = UPPER(:p8::text))
      AND NULLIF(TRIM(a.status), '') IS NOT NULL
      AND a.api_name IS NOT NULL
    GROUP BY a.api_name, UPPER(NULLIF(TRIM(a.status), ''))`;

    const result = await new QueryView(baseQuery, params)
      .applyWithOutPagination()
      .execute();

    const statuses = [...new Set(result.data.map((row) => row.status))].sort();
    const times = ["Local Time s", "Preprocess Time s", "Response Time s"];
    const grouped = new Map();

    result.data.forEach((row) => {
      if (!grouped.has(row.api_name)) {
        grouped.set(row.api_name, {
          api_name: row.api_name,
          total: 0,
          response_sum: 0,
          response_count: 0,
          local_sum: 0,
          local_count: 0,
          preprocess_sum: 0,
          preprocess_count: 0,
          counts: {},
        });
      }

      const group = grouped.get(row.api_name);
      group.total += row.total;
      group.response_sum += row.response_sum;
      group.response_count += row.response_count;
      group.local_sum += row.local_sum;
      group.local_count += row.local_count;
      group.preprocess_sum += row.preprocess_sum;
      group.preprocess_count += row.preprocess_count;
      group.counts[row.status] = row.total;
    });

    const data = [...grouped.values()].map((group) => {
      const row = {
        api_name: group.api_name,
        total: group.total,
        time_s: group.response_count
          ? Number(
              (group.response_sum / group.response_count / 1000).toFixed(1),
            )
          : 0,
        "Local Time s": group.local_count
          ? Number((group.local_sum / group.local_count / 1000).toFixed(1))
          : 0,
        "Preprocess Time s": group.preprocess_count
          ? Number(
              (group.preprocess_sum / group.preprocess_count / 1000).toFixed(1),
            )
          : 0,
        "Response Time s": group.response_count
          ? Number(
              (group.response_sum / group.response_count / 1000).toFixed(1),
            )
          : 0,
      };

      statuses.forEach((status) => {
        const count = group.counts[status] || 0;
        row[`${status} Count`] = count;
        row[`${status} %`] = group.total
          ? Number(((count / group.total) * 100).toFixed(2))
          : 0;
        const errorCount = Number(row["ERROR Count"] || 0);
        const successCount = Number(row["SUCCESS Count"] || 0);
        const totalCount = errorCount + successCount;
        const errorPercentage = totalCount
          ? ((errorCount / totalCount) * 100).toFixed(2)
          : "0.00";
        row.errorPercentage = errorPercentage;
      });

      return row;
    });

    return { data, total: data.length, statuses, times };
  } catch (error) {
    logger.error("error in ttModel -> getApiSummaryReport", error);
    throw error;
  }
};

export const getHourlyApiPerformance = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    page = 1,
    limit = 10,
    _sort,
    _filter,
  } = filters;
  const { pageNum, limitNum } = getPagination(page, limit);
  try {
    const params = {
      p1: startDate || null,
      p2: endDate || null,
      p3: payerId ? Number(payerId) : null,
      p4: apiName || null,
      p5: apiProvider || null,
      p6: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      p7: apiFunction || null,
      p8: status || null,
    };

    const baseQuery = `SELECT
      TO_CHAR(a.creation_date, 'HH24') AS bucket,
      EXTRACT(HOUR FROM a.creation_date)::int AS bucket_sort,
      a.api_name AS api_name,
      COUNT(*)::int AS api_total,
      COALESCE(SUM(a.response_time_ms), 0)::float AS response_sum,
      COUNT(a.response_time_ms)::int AS response_count,
      COALESCE(SUM(a.local_api_time_ms), 0)::float AS local_sum,
      COUNT(a.local_api_time_ms)::int AS local_count,
      COUNT(CASE WHEN UPPER(a.status) IN ('SUCCEEDED', 'SUCCESS', 'PASS', 'PASSED') THEN 1 END)::int AS succeeded_count
    FROM api_transaction a
    WHERE a.payer_id IS NOT NULL
      AND (:p1::text IS NULL OR a.creation_date >= TO_TIMESTAMP(:p1, 'YYYY-MM-DD HH24:MI'))
      AND (:p2::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND (:p3::bigint IS NULL OR a.payer_id = :p3::bigint)
      AND (:p4::text IS NULL OR UPPER(a.api_name) = UPPER(:p4::text))
      AND a.api_name IS NOT NULL
      AND (:p5::text IS NULL OR UPPER(a.api_provider) = UPPER(:p5::text))
      AND a.facility_id IN (:p6)
      AND (:p7::text IS NULL OR UPPER(a.api_function) = UPPER(:p7::text))
      AND (:p8::text IS NULL OR UPPER(a.status) = UPPER(:p8::text))
    GROUP BY TO_CHAR(a.creation_date, 'HH24'), EXTRACT(HOUR FROM a.creation_date), a.api_name`;

    const result = await new QueryView(baseQuery, params)
      .apply({ _sort: _sort || "bucket_sort,asc", _filter })
      .execute();
    const timeReport = pivotTimeBucketsByApi(result.data, "hour");

    return {
      ...buildPaginatedResult(timeReport, pageNum, limitNum),
      apiNames: timeReport.apiNames,
    };
  } catch (error) {
    logger.error("error in ttModel -> getHourlyApiPerformance", error);
    throw error;
  }
};

export const getDailyApiPerformance = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    page = 1,
    limit = 10,
    _sort,
    _filter,
  } = filters;
  const { pageNum, limitNum } = getPagination(page, limit);
  try {
    const params = {
      p1: startDate || null,
      p2: endDate || null,
      p3: payerId ? Number(payerId) : null,
      p4: apiName || null,
      p5: apiProvider || null,
      p6: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      p7: apiFunction || null,
      p8: status || null,
    };

    const baseQuery = `SELECT
      TO_CHAR(DATE_TRUNC('day', a.creation_date), 'DD-MM-YYYY') AS bucket,
      EXTRACT(EPOCH FROM DATE_TRUNC('day', a.creation_date))::bigint AS bucket_sort,
      a.api_name AS api_name,
      COUNT(*)::int AS api_total,
      COALESCE(SUM(a.response_time_ms), 0)::float AS response_sum,
      COUNT(a.response_time_ms)::int AS response_count,
      COALESCE(SUM(a.local_api_time_ms), 0)::float AS local_sum,
      COUNT(a.local_api_time_ms)::int AS local_count,
      COUNT(CASE WHEN UPPER(a.status) IN ('SUCCEEDED', 'SUCCESS', 'PASS', 'PASSED') THEN 1 END)::int AS succeeded_count
    FROM api_transaction a
    WHERE a.payer_id IS NOT NULL
      AND (:p1::text IS NULL OR a.creation_date >= TO_TIMESTAMP(:p1, 'YYYY-MM-DD HH24:MI'))
      AND (:p2::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND (:p3::bigint IS NULL OR a.payer_id = :p3::bigint)
      AND (:p4::text IS NULL OR UPPER(a.api_name) = UPPER(:p4::text))
      AND a.api_name IS NOT NULL
      AND (:p5::text IS NULL OR UPPER(a.api_provider) = UPPER(:p5::text))
      AND a.facility_id IN (:p6)
      AND (:p7::text IS NULL OR UPPER(a.api_function) = UPPER(:p7::text))
      AND (:p8::text IS NULL OR UPPER(a.status) = UPPER(:p8::text))
    GROUP BY DATE_TRUNC('day', a.creation_date), TO_CHAR(DATE_TRUNC('day', a.creation_date), 'DD-MM-YYYY'), a.api_name`;

    const result = await new QueryView(baseQuery, params)
      .apply({ _sort: _sort || "bucket_sort,asc", _filter })
      .execute();
    const timeReport = pivotTimeBucketsByApi(result.data, "created");

    return {
      ...buildPaginatedResult(timeReport, pageNum, limitNum),
      apiNames: timeReport.apiNames,
    };
  } catch (error) {
    logger.error("error in ttModel -> getDailyApiPerformance", error);
    throw error;
  }
};

export const getTopFailedErrorsSummary = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    page = 1,
    limit = 10,
  } = filters;

  const { pageNum, limitNum } = getPagination(page, limit);

  const dateFormat = getTimestampFormat();

  try {
    const params = {
      p1: startDate || null,
      p2: endDate || null,
      p3: payerId ? Number(payerId) : null,
      p4: apiName || null,
      p5: apiProvider || null,
      p6: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      p7: apiProvider || null,
      p8: apiFunction || null,
      p9: status || null,
      p10: dateFormat,
    };

    const baseQuery = `
      SELECT
        COUNT(*) AS total,
        a.error_message,
        MAX(a.api_trans_id) AS last_trans_id,
        TO_CHAR(MAX(a.creation_date), :p10) AS last_at,
        MIN(a.api_trans_id) AS first_trans_id,
        TO_CHAR(MIN(a.creation_date), :p10) AS first_at
      FROM api_transaction a
      WHERE
        a.payer_id IS NOT NULL
        AND UPPER(a.status) = 'FAILED'
        AND a.error_message IS NOT NULL
        AND a.error_message <> ''
        AND (:p1::text IS NULL OR a.creation_date >= TO_TIMESTAMP(:p1, 'YYYY-MM-DD HH24:MI'))
        AND (:p2::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
        AND (:p3::bigint IS NULL OR a.payer_id = :p3::bigint)
        AND (:p4::text IS NULL OR UPPER(a.api_name) = UPPER(:p4::text))
        AND a.api_name is not null
        AND (:p5::text IS NULL OR UPPER(a.api_provider) = UPPER(:p5::text))
        AND a.facility_id IN (:p6)
        AND (:p8::text IS NULL OR UPPER(a.api_function) = UPPER(:p8::text))
        AND (:p9::text IS NULL OR UPPER(a.status) = UPPER(:p9::text))
      GROUP BY a.error_message
    `;

    const result = await new QueryView(baseQuery, params)
      .apply({
        _sort: filters._sort || "total,desc",
        _filter: filters._filter,
        page: filters.page,
        limit: filters.limit,
      })
      .execute();

    return buildPaginatedResult(result, pageNum, limitNum);
  } catch (error) {
    logger.error("error in ttModel -> getTopFailedErrorsSummary", error);
    throw error;
  }
};

export const getTopFailedErrorsDetails = async (filters = {}) => {
  const {
    errorMessage = null,
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    _sort = null,
    _filter = null,
    page = 1,
    limit = 10,
  } = filters;

  const { pageNum, limitNum } = getPagination(page, limit);

  if (!errorMessage) {
    return buildPaginatedResult({ data: [], total: 0 }, pageNum, limitNum);
  }

  const dateFormat = getTimestampFormat();

  const params = {
    p1: errorMessage,
    p2: startDate || null,
    p3: endDate || null,
    p4: payerId ? Number(payerId) : null,
    p5: apiName || null,
    p6: apiProvider || null,
    p7: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
    p8: apiFunction || null,
    p9: status || null,
    p10: dateFormat,
  };

  const baseQuery = `
    SELECT
      a.api_trans_id,
      a.facility_id,
      a.api_name,
      a.api_function,
      a.creation_date AS date,
      TO_CHAR(a.creation_date, :p10) AS creation_date,
      EXTRACT(EPOCH FROM a.creation_date) AS creation_date_ts,
      a.status,
      a.outcome,
      a.adjudication_outcome,
      a.patient_id,
      a.episode_no,
      a.transaction_id,
      a.payer_id,
      a.bundle_count,
      a.response_size_kb AS res_kb,
      a.dest_url,
      a.cancel_api_trans_id,
      a.error_message
    FROM api_transaction a
    WHERE a.payer_id IS NOT NULL
      AND a.error_message = :p1::text
      AND a.error_message IS NOT NULL
      AND a.error_message <> ''
      AND UPPER(a.status) = 'FAILED'
      AND (:p2::text IS NULL OR a.creation_date >= TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'))
      AND (:p3::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP(:p3, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND (:p4::bigint IS NULL OR a.payer_id = :p4::bigint)
      AND (:p5::text IS NULL OR UPPER(a.api_name) = UPPER(:p5::text))
      AND a.api_name IS NOT NULL
      AND (:p6::text IS NULL OR UPPER(a.api_provider) = UPPER(:p6::text))
      AND a.facility_id IN (:p7)
      AND (:p8::text IS NULL OR UPPER(a.api_function) = UPPER(:p8::text))
      AND (:p9::text IS NULL OR UPPER(a.status) = UPPER(:p9::text))
  `;

  try {
    const result = await new QueryView(baseQuery, params)
      .apply({
        _sort: _sort || "creation_date,desc",
        _filter,
        page,
        limit,
      })
      .execute();

    return buildPaginatedResult(result, pageNum, limitNum);
  } catch (error) {
    logger.error("Error in ttModel -> getTopFailedErrorsDetails", error);
    throw error;
  }
};

export const getErrorMessageSummary = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    nphiesCode = null,
    page = 1,
    limit = 10,
  } = filters;

  const { pageNum, limitNum } = getPagination(page, limit);

  const dateFormat = getTimestampFormat();

  try {
    const params = {
      p1: startDate || null,
      p2: endDate || null,
      p3: payerId ? Number(payerId) : null,
      p4: apiName || null,
      p5: apiProvider || null,
      p6: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      p7: apiProvider || null,
      p8: apiFunction || null,
      p9: status || null,
      p10: dateFormat,
      p11: nphiesCode,
    };
    const baseQuery = `
      select COUNT(DISTINCT a.api_trans_id) as total,
        NULLIF(m.nphies_message_id, '') as nphies_message_id,
        m.nphies_message as nphies_message,
        MAX(a.api_trans_id) as last_trans_id,
        TO_CHAR(MAX(a.creation_date), :p10) as last_at,
        MIN(a.api_trans_id) as first_trans_id,
        TO_CHAR(MIN(a.creation_date), :p10) as first_at
      from api_message m
      join api_transaction a on
      a.api_trans_id = m.api_trans_id
      where a.payer_id IS NOT NULL
      and (:p1::text IS NULL OR a.creation_date >= TO_TIMESTAMP(:p1, 'YYYY-MM-DD HH24:MI'))
      and (:p2::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      and (:p3::bigint IS NULL OR a.payer_id = :p3::bigint)
      and (:p4::text IS NULL OR UPPER(a.api_name) = UPPER(:p4::text))
      and (:p5::text IS NULL OR UPPER(a.api_provider) = UPPER(:p5::text))
      and a.api_name is not null
      AND a.facility_id IN (:p6)
      AND (:p8::text IS NULL OR UPPER(a.api_function) = UPPER(:p8::text))
      AND (:p9::text IS NULL OR UPPER(a.status) = UPPER(:p9::text))
      AND (:p11::text IS NULL OR NULLIF(m.nphies_message_id, '') = :p11::text)
      group by NULLIF(m.nphies_message_id, ''), m.nphies_message
    `;

    const result = await new QueryView(baseQuery, params)
      .apply({
        _sort: filters._sort || "total,desc",
        _filter: filters._filter,
        page: filters.page,
        limit: filters.limit,
      })
      .execute();
    const data = result.data.map((row) => ({
      ...row,
      last_at: formatRiyadhTimestamp(row.last_at),
      first_at: formatRiyadhTimestamp(row.first_at),
    }));
    return buildPaginatedResult(result, pageNum, limitNum, data);
  } catch (error) {
    logger.error("error in ttModel -> getErrorMessageSummary", error);
    throw error;
  }
};

export const getErrorMessageDetails = async (filters = {}) => {
  const {
    nphiesMessageId = null,
    nphiesMessage = null,
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    _sort = null,
    _filter = null,
    page = 1,
    limit = 10,
  } = filters;
  const { pageNum, limitNum } = getPagination(page, limit);

  const dateFormat = getTimestampFormat();

  const params = {
    p1: nphiesMessageId,
    p2: nphiesMessage,
    p3: startDate || null,
    p4: endDate || null,
    p5: dateFormat,
    p6: payerId ? Number(payerId) : null,
    p7: apiName || null,
    p8: apiProvider || null,
    p9: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
    p10: apiFunction || null,
    p11: status || null,
  };

  const baseQuery = `
    SELECT
      a.api_trans_id,
      a.facility_id,
      a.api_name,
      a.api_function,
      a.creation_date AT TIME ZONE 'Asia/Riyadh' AS date,
      TO_CHAR(a.creation_date AT TIME ZONE 'Asia/Riyadh', :p5) AS creation_date,
      EXTRACT(EPOCH FROM a.creation_date) AS creation_date_ts,
      a.status,
      a.outcome,
      a.adjudication_outcome,
      a.patient_id,
      a.episode_no,
      a.transaction_id,
      a.payer_id,
      a.bundle_count,
      LENGTH(a.response) / 1024 AS res_kb,
      a.dest_url,
      a.cancel_api_trans_id,
      a.error_message
    FROM api_transaction a
    WHERE a.payer_id IS NOT NULL
      AND EXISTS (
      SELECT 1
      FROM api_message m
      WHERE m.api_trans_id = a.api_trans_id
        AND NULLIF(m.nphies_message_id, '') IS NOT DISTINCT FROM :p1::text
        AND m.nphies_message IS NOT DISTINCT FROM :p2::text
    )
      AND (:p3::text IS NULL OR a.creation_date >= TO_TIMESTAMP(:p3, 'YYYY-MM-DD HH24:MI'))
      AND (:p4::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP(:p4, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND (:p6::bigint IS NULL OR a.payer_id = :p6::bigint)
      AND (:p7::text IS NULL OR UPPER(a.api_name) = UPPER(:p7::text))
      AND a.api_name IS NOT NULL
      AND (:p8::text IS NULL OR UPPER(a.api_provider) = UPPER(:p8::text))
      AND a.facility_id IN (:p9)
      AND (:p10::text IS NULL OR UPPER(a.api_function) = UPPER(:p10::text))
      AND (:p11::text IS NULL OR UPPER(a.status) = UPPER(:p11::text))
  `;

  const result = await new QueryView(baseQuery, params)
    .apply({
      _sort: _sort || "creation_date,desc",
      _filter,
      page,
      limit,
    })
    .execute();

  return buildPaginatedResult(result, pageNum, limitNum);
};

export const getErrorMessageMessages = async (filters = {}) => {
  const {
    nphiesMessageId = null,
    apiTransId = null,
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    page = 1,
    limit = 10,
  } = filters;
  const { pageNum, limitNum } = getPagination(page, limit);
  const offset = (pageNum - 1) * limitNum;
  if (!nphiesMessageId && !apiTransId)
    return buildMessagesResult([], 0, pageNum, limitNum);

  const messageSelect = `
        m.message_id,
        m.api_trans_id,
        m.nphies_message_id,
        m.nphies_message,
        m.error_element,
        m.element_value,
        m.item_no,
        m.response_id
      `;

  let baseQuery;
  let filterValues;

  if (apiTransId) {
    baseQuery = `
      SELECT ${messageSelect}
      FROM api_message m
      WHERE m.api_trans_id = $1::bigint
      ORDER BY m.message_id
    `;
    filterValues = [apiTransId];
  } else {
    baseQuery = `
      SELECT ${messageSelect}
      FROM api_message m
      JOIN api_transaction a ON a.api_trans_id = m.api_trans_id
      WHERE a.payer_id IS NOT NULL
        AND m.nphies_message_id = $1::text
        AND m.nphies_message_id IS NOT NULL
        AND m.nphies_message_id <> ''
        AND ($2::text IS NULL OR a.creation_date >= TO_TIMESTAMP($2, 'YYYY-MM-DD HH24:MI'))
        AND ($3::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP($3, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
        AND ($4::bigint IS NULL OR a.payer_id = $4::bigint)
        AND ($5::text IS NULL OR UPPER(a.api_name) = UPPER($5::text))
        AND a.api_name IS NOT NULL
        AND ($6::text IS NULL OR UPPER(a.api_provider) = UPPER($6::text))
        AND ($7::int[] IS NULL OR a.facility_id = ANY($7::int[]))
        AND ($8::text IS NULL OR UPPER(a.api_function) = UPPER($8::text))
        AND ($9::text IS NULL OR UPPER(a.status) = UPPER($9::text))
      ORDER BY m.message_id
    `;
    filterValues = [
      nphiesMessageId,
      startDate || null,
      endDate || null,
      payerId ? Number(payerId) : null,
      apiName || null,
      apiProvider || null,
      facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      apiFunction || null,
      status || null,
    ];
  }

  const result = await query(
    `${baseQuery} LIMIT $${filterValues.length + 1} OFFSET $${filterValues.length + 2}`,
    [...filterValues, limitNum, offset],
  );
  const countResult = await query(
    `SELECT COUNT(*) AS count FROM (${baseQuery}) sub`,
    filterValues,
  );
  const totalRows = parseInt(countResult.rows[0].count, 10);
  return buildMessagesResult(result.rows, totalRows, pageNum, limitNum);
};

export const getPayerPerformanceSummary = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    page = 1,
    limit = 10,
    _sort,
    _filter,
  } = filters;
  const { pageNum, limitNum } = getPagination(page, limit);
  try {
    const params = {
      p1: startDate || null,
      p2: endDate || null,
      p3: payerId ? Number(payerId) : null,
      p4: apiName || null,
      p5: apiProvider || null,
      p6: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      p7: apiFunction || null,
      p8: status || null,
    };

    const baseQuery = `
        SELECT
        payer_id,
        description,
        trans,
        succeded_count,
        ROUND(CASE WHEN trans = 0 THEN 0 ELSE succeded_count * 100.0 / trans END) AS succeeded_percent,
        error_count,
        ROUND(CASE WHEN trans = 0 THEN 0 ELSE error_count * 100.0 / trans END) AS error_percent,
        failed_count,
        ROUND(CASE WHEN trans = 0 THEN 0 ELSE failed_count * 100.0 / trans END) AS failed_percent,
        pending_count,
        ROUND(CASE WHEN trans = 0 THEN 0 ELSE pending_count * 100.0 / trans END) AS pending_percent,
        other_count,
        ROUND(CASE WHEN trans = 0 THEN 0 ELSE other_count * 100.0 / trans END) AS other_percent,
        claims,
        approved,
        ROUND(CASE WHEN claims = 0 THEN 0 ELSE approved * 100.0 / claims END) AS approved_percent,
        rejected,
        ROUND(CASE WHEN claims = 0 THEN 0 ELSE rejected * 100.0 / claims END) AS rejected_percent,
        time_s,
        local_time_s
        FROM (
            SELECT
            a.payer_id,
            p.short_name AS description,
            COUNT(DISTINCT a.api_trans_id) AS trans,
            COUNT(DISTINCT CASE WHEN UPPER(a.status) IN ('SUCCEEDED', 'SUCCESS') THEN a.api_trans_id END) AS succeded_count,
            COUNT(DISTINCT CASE WHEN UPPER(a.status) = 'ERROR' THEN a.api_trans_id END) AS error_count,
            COUNT(DISTINCT CASE WHEN UPPER(a.status) IN ('FAILED', 'FAIL') THEN a.api_trans_id END) AS failed_count,
            COUNT(DISTINCT CASE WHEN a.status IS NULL OR a.status IN ('-', '') THEN a.api_trans_id END) AS pending_count,
            COUNT(DISTINCT CASE WHEN a.status IS NOT NULL AND UPPER(a.status) NOT IN ('ERROR', 'FAILED', 'FAIL', 'SUCCEEDED', 'SUCCESS', '-', '') THEN a.api_trans_id END) AS other_count,
            COUNT(DISTINCT v.req_no) AS claims,
            COUNT(DISTINCT CASE WHEN a.outcome = 'APPROVED' THEN v.req_no END) AS approved,
            COUNT(DISTINCT CASE WHEN a.outcome = 'REJECTED' THEN v.req_no END) AS rejected,
            ROUND(AVG(a.response_time_ms) / 1000.0, 1) AS time_s,
            ROUND(AVG(a.local_api_time_ms) / 1000.0, 1) AS local_time_s
            FROM
            api_transaction a
            LEFT JOIN rcm.payer p ON p.payer_id = a.payer_id
            LEFT JOIN service_request v ON a.api_trans_id = v.api_trans_id
            WHERE a.payer_id IS NOT NULL
              AND (:p1::text IS NULL OR a.creation_date >= TO_TIMESTAMP(:p1, 'YYYY-MM-DD HH24:MI'))
              AND (:p2::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
              AND (:p3::bigint IS NULL OR a.payer_id = :p3::bigint)
              AND (:p4::text IS NULL OR UPPER(a.api_name) = UPPER(:p4::text))
              AND (:p5::text IS NULL OR UPPER(a.api_provider) = UPPER(:p5::text))
              AND a.facility_id IN (:p6)
              AND (:p7::text IS NULL OR UPPER(a.api_function) = UPPER(:p7::text))
              AND (:p8::text IS NULL OR UPPER(a.status) = UPPER(:p8::text))
            GROUP BY
            a.payer_id, p.short_name
            ) AS subquery
            `;

    const result = await new QueryView(baseQuery, params)
      .apply({ _sort: _sort || "payer_id,asc", _filter, page, limit })
      .execute();
    return buildPaginatedResult(result, pageNum, limitNum);
  } catch (error) {
    logger.error("error in ttModel -> getPayerPerformanceSummary", error);
    throw error;
  }
};

export const getClaimRejectionSummary = async (filters = {}) => {
  try {
    const {
      patientId = null,
      payerId = null,
      startDate = null,
      endDate = null,
      facilityIds = [-1],
      page = 1,
      limit = 10,
      _sort,
      _filter,
    } = filters;
    const { pageNum, limitNum } = getPagination(page, limit);

    const params = {
      p1: getDateFormat(),
      p2: patientId,
      p3: payerId,
      p4: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      p5: startDate || null,
      p6: endDate || null,
    };

    const baseQuery = `
      SELECT
        ah.msg_id,
       STRING_AGG(DISTINCT ah.payer_id, ', ') AS payer_ids ,
        nec.display,
        to_char(MIN(ah.response_date), :p1) AS first,
        to_char(MAX(ah.response_date), :p1) AS last,
        COUNT(distinct api_trans_id)  claim_count,
        COUNT(distinct payer_id)  payer_count,
        SUM(ah.amount) total_amount,
        COUNT(*) record_count
      FROM
        approval_history ah
      JOIN nphies_error_code nec ON
        nec.error_id = ah.msg_id
      WHERE
        ah.request = 'CLAIM'
        AND ah.status = 'REJECTED'
        AND (:p2::text IS NULL OR ah.patient_id = :p2::text)
        AND (:p3::text IS NULL OR ah.payer_id = :p3::text)
        AND ah.facility_id IN (:p4)
        AND (:p5::text IS NULL OR ah.response_date >= TO_TIMESTAMP(:p5, 'YYYY-MM-DD HH24:MI'))
        AND (:p6::text IS NULL OR ah.response_date < COALESCE(TO_TIMESTAMP(:p6, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      GROUP BY
        ah.msg_id,
        nec.display
    `;

    const result = await new QueryView(baseQuery, params)
      .apply({ _sort: _sort || "msg_id,asc", _filter, page, limit })
      .execute();
    return buildPaginatedResult(result, pageNum, limitNum);
  } catch (error) {
    logger.error("error in ttModel -> getClaimRejectionSummary", error);
    throw error;
  }
};

export const getClaimRejectionDetails = async (filters = {}) => {
  try {
    const {
      msgId = null,
      payerId = null,
      first = null,
      last = null,
      facilityIds = [-1],
      page = 1,
      limit = 10,
      _sort,
      _filter,
    } = filters;
    const { pageNum, limitNum } = getPagination(page, limit);

    let startDate = null;
    let endDate = null;
    if (first && last) {
      const [day, month, year] = last.split("-");
      const dateStrLast = dayjs(`${year}-${month}-${day}`).format(
        "YYYY-MM-DD HH:mm:ss",
      );
      const [dayFr, monthFr, yearFr] = first.split("-");
      const dateStrFirst = dayjs(`${yearFr}-${monthFr}-${dayFr}`).format(
        "YYYY-MM-DD HH:mm:ss",
      );
      startDate = dayjs(dateStrFirst)
        .startOf("day")
        .format("YYYY-MM-DD HH:mm");
      endDate = dayjs(dateStrLast).endOf("day").format("YYYY-MM-DD HH:mm");
    }

    const params = {
      p1: getDateFormat(),
      p2: msgId,
      p3: payerId,
      p4: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      p5: startDate,
      p6: endDate,
    };

    const baseQuery = `
      SELECT
        ah.id,
        ah.msg_id,
        ah.request,
        ah.status,
        ah.payer_id,
        ah.amount,
        ah.patient_id,
        ah.api_trans_id,
        ah.service_code,
        ah.diagnosis_code,
        ah.treatment_type,
        ah.specialty,
        to_char(ah.creation_date, :p1) AS creation_date,
        to_char(ah.response_date, :p1) AS response_date,
        nec.display AS error_display,
        p.short_name AS payer_description,
        CONCAT(
          INITCAP(pt.first_name), 
          ' ',
          UPPER(pt.last_name)
        ) AS patient_full_name ,
         ah.gender ,
         ah.age ,
         ah.chief_complaint,
        ah.reason
      FROM
        approval_history ah
      JOIN nphies_error_code nec ON
        nec.error_id = ah.msg_id
      LEFT JOIN payer p ON
        p.payer_id::text = ah.payer_id::text
      LEFT JOIN patient pt ON
        pt.patient_id::text = ah.patient_id::text
      WHERE
        ah.request = 'CLAIM'
        AND ah.status = 'REJECTED'
        AND (:p2::text IS NULL OR ah.msg_id = :p2::text)
        AND (:p3::text IS NULL OR ah.payer_id = :p3::text)
        AND ah.facility_id IN (:p4)
        AND (:p5::text IS NULL OR ah.response_date >= TO_TIMESTAMP(:p5, 'YYYY-MM-DD HH24:MI'))
        AND (:p6::text IS NULL OR ah.response_date < COALESCE(TO_TIMESTAMP(:p6, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
    `;

    const result = await new QueryView(baseQuery, params)
      .apply({ _sort: _sort || "response_date,asc", _filter, page, limit })
      .execute();

    return buildPaginatedResult(result, pageNum, limitNum);
  } catch (error) {
    logger.error("Error in getClaimRejectionDetails:", error);
    throw error;
  }
};

export const getErrorCodeSummary = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    page = 1,
    limit = 10,
  } = filters;
  const { pageNum, limitNum } = getPagination(page, limit);

  const dateFormat = getTimestampFormat();

  const params = {
    p1: startDate || null,
    p2: endDate || null,
    p3: payerId ? Number(payerId) : null,
    p4: apiName || null,
    p5: apiProvider || null,
    p6: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
    p7: apiFunction || null,
    p8: status || null,
    p9: dateFormat,
  };
  const baseQuery = `
    SELECT COUNT(DISTINCT a.api_trans_id) AS total,
      NULLIF(m.nphies_message_id, '') AS nphies_message_id,
      MAX(m.nphies_message) AS message,
      ROUND(100.0 * COUNT(DISTINCT a.api_trans_id) / NULLIF(SUM(COUNT(DISTINCT a.api_trans_id)) OVER (), 0), 2) AS pct,
      TO_CHAR(MAX(a.creation_date), :p9) AS last_at
    FROM api_message m
    JOIN api_transaction a ON a.api_trans_id = m.api_trans_id
    WHERE a.payer_id IS NOT NULL
      AND (:p1::text IS NULL OR a.creation_date >= TO_TIMESTAMP(:p1, 'YYYY-MM-DD HH24:MI'))
      AND (:p2::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND (:p3::bigint IS NULL OR a.payer_id = :p3::bigint)
      AND (:p4::text IS NULL OR UPPER(a.api_name) = UPPER(:p4::text))
      AND (:p5::text IS NULL OR UPPER(a.api_provider) = UPPER(:p5::text))
      AND a.facility_id IN (:p6)
      AND (:p7::text IS NULL OR UPPER(a.api_function) = UPPER(:p7::text))
      AND (:p8::text IS NULL OR UPPER(a.status) = UPPER(:p8::text))
      AND NULLIF(m.nphies_message_id, '') IS NOT NULL
    GROUP BY NULLIF(m.nphies_message_id, '')
  `;

  const result = await new QueryView(baseQuery, params)
    .apply({
      _sort: filters._sort || "total,desc",
      _filter: filters._filter,
      page: filters.page,
      limit: filters.limit,
    })
    .execute();
  const data = result.data.map((row) => ({
    ...row,
    last_at: formatRiyadhTimestamp(row.last_at),
  }));
  return buildPaginatedResult(result, pageNum, limitNum, data);
};

export const getErrorDailyPerformance = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    nphiesCode = null,
  } = filters;

  const params = [
    startDate || null,
    endDate || null,
    payerId ? Number(payerId) : null,
    apiName || null,
    apiProvider || null,
    facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
    apiFunction || null,
    status || null,
    nphiesCode || null,
  ];
  const res = await query(
    `SELECT TO_CHAR(date_trunc('day', a.creation_date), 'DD-MM-YYYY') AS day,
      EXTRACT(EPOCH FROM date_trunc('day', a.creation_date)) AS day_ts,
      COUNT(*) FILTER (WHERE UPPER(a.status) = 'ERROR' OR a.status IS NULL) AS error_count,
      COUNT(*) FILTER (WHERE UPPER(a.status) IN ('FAIL', 'FAILED')) AS fail_count,
      COUNT(*) FILTER (WHERE UPPER(a.status) = 'SUCCESS') AS success_count,
      COUNT(*) AS total,
      ROUND(100.0 * COUNT(*) FILTER (WHERE UPPER(a.status) = 'ERROR' OR a.status IS NULL) / NULLIF(COUNT(*), 0), 2) AS error_percent,
      ROUND(100.0 * COUNT(*) FILTER (WHERE UPPER(a.status) IN ('FAIL', 'FAILED')) / NULLIF(COUNT(*), 0), 2) AS fail_percent,
      ROUND(100.0 * COUNT(*) FILTER (WHERE UPPER(a.status) = 'ERROR') / NULLIF(COUNT(*) FILTER (WHERE UPPER(a.status) IN ('ERROR', 'SUCCESS')), 0), 2) AS error_sent_percent
    FROM api_transaction a
    WHERE a.payer_id IS NOT NULL
      AND ($1::text IS NULL OR a.creation_date >= TO_TIMESTAMP($1, 'YYYY-MM-DD HH24:MI'))
      AND ($2::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP($2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND ($3::bigint IS NULL OR a.payer_id = $3::bigint)
      AND ($4::text IS NULL OR UPPER(a.api_name) = UPPER($4::text))
      AND ($5::text IS NULL OR UPPER(a.api_provider) = UPPER($5::text))
      AND a.facility_id = ANY($6::int[])
      AND ($7::text IS NULL OR UPPER(a.api_function) = UPPER($7::text))
      AND ($8::text IS NULL OR UPPER(a.status) = UPPER($8::text))
      AND ($9::text IS NULL OR EXISTS (SELECT 1 FROM api_message m WHERE m.api_trans_id = a.api_trans_id AND NULLIF(m.nphies_message_id, '') = $9::text))
    GROUP BY 1, 2
    ORDER BY 2 ASC`,
    params,
  );
  return { data: res.rows };
};

export const getErrorHourlyPerformance = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    nphiesCode = null,
    dayTs = null,
  } = filters;

  const dayCount =
    dayTs === undefined || dayTs === null || dayTs === ""
      ? Math.max(
          1,
          Math.round(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
              86400000,
          ) + 1,
        )
      : 1;
  const params = [
    startDate || null,
    endDate || null,
    payerId ? Number(payerId) : null,
    apiName || null,
    apiProvider || null,
    facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
    apiFunction || null,
    status || null,
    dayCount,
    nphiesCode || null,
    dayTs,
  ];
  const res = await query(
    `WITH hours AS (
      SELECT generate_series(0, 23) AS hour
    ),
    agg AS (
      SELECT EXTRACT(HOUR FROM a.creation_date)::int AS hour,
        COUNT(*) FILTER (WHERE UPPER(a.status) = 'ERROR' OR a.status IS NULL) AS error_count,
        COUNT(*) FILTER (WHERE UPPER(a.status) = 'ERROR') AS strict_error_count,
        COUNT(*) FILTER (WHERE UPPER(a.status) IN ('FAIL', 'FAILED')) AS fail_count,
        COUNT(*) FILTER (WHERE UPPER(a.status) = 'SUCCESS') AS success_count,
        COUNT(*) AS total
      FROM api_transaction a
      WHERE a.payer_id IS NOT NULL
        AND ($1::text IS NULL OR a.creation_date >= TO_TIMESTAMP($1, 'YYYY-MM-DD HH24:MI'))
        AND ($2::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP($2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
        AND ($3::bigint IS NULL OR a.payer_id = $3::bigint)
        AND ($4::text IS NULL OR UPPER(a.api_name) = UPPER($4::text))
        AND ($5::text IS NULL OR UPPER(a.api_provider) = UPPER($5::text))
        AND a.facility_id = ANY($6::int[])
        AND ($7::text IS NULL OR UPPER(a.api_function) = UPPER($7::text))
        AND ($8::text IS NULL OR UPPER(a.status) = UPPER($8::text))
        AND ($10::text IS NULL OR EXISTS (SELECT 1 FROM api_message m WHERE m.api_trans_id = a.api_trans_id AND NULLIF(m.nphies_message_id, '') = $10::text))
        AND ($11::numeric IS NULL OR EXTRACT(EPOCH FROM date_trunc('day', a.creation_date)) = $11::numeric)
      GROUP BY 1
    )
    SELECT h.hour,
      COALESCE(a.error_count, 0) AS error_count,
      COALESCE(a.fail_count, 0) AS fail_count,
      COALESCE(a.success_count, 0) AS success_count,
      COALESCE(a.total, 0) AS total,
      ROUND(COALESCE(a.error_count, 0) / $9::numeric, 2) AS avg_error_count,
      ROUND(COALESCE(a.fail_count, 0) / $9::numeric, 2) AS avg_fail_count,
      ROUND(100.0 * COALESCE(a.error_count, 0) / NULLIF(COALESCE(a.total, 0), 0), 2) AS error_percent,
      ROUND(100.0 * COALESCE(a.fail_count, 0) / NULLIF(COALESCE(a.total, 0), 0), 2) AS fail_percent,
      ROUND(100.0 * COALESCE(a.strict_error_count, 0) / NULLIF(COALESCE(a.strict_error_count, 0) + COALESCE(a.success_count, 0), 0), 2) AS error_sent_percent
    FROM hours h
    LEFT JOIN agg a ON a.hour = h.hour
    ORDER BY h.hour ASC`,
    params,
  );
  return { day_count: dayCount, data: res.rows };
};

export const getFacilitySummary = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiName,
    apiProvider,
    facilityIds = [-1],
    apiFunction = null,
    status = null,
    page = 1,
    limit = 10,
  } = filters;
  const { pageNum, limitNum } = getPagination(page, limit);

  const params = {
    p1: startDate || null,
    p2: endDate || null,
    p3: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
    p4: payerId ? Number(payerId) : null,
    p5: apiName || null,
    p6: apiProvider || null,
    p7: apiFunction || null,
    p8: status || null,
  };
  const baseQuery = `
    SELECT f.facility_id,
      MAX(f.name) AS facility_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE UPPER(t.status) = 'SUCCESS') AS succeeded_count,
      COUNT(*) FILTER (WHERE UPPER(t.status) = 'ERROR') AS error_count,
      COUNT(*) FILTER (WHERE UPPER(t.status) IN ('FAIL', 'FAILED')) AS failed_count,
      ROUND(COUNT(*) FILTER (WHERE UPPER(t.status) = 'SUCCESS') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE UPPER(t.status) IN ('SUCCESS', 'ERROR')), 0), 2) AS succeeded_percent,
      ROUND(COUNT(*) FILTER (WHERE UPPER(t.status) = 'ERROR') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE UPPER(t.status) IN ('SUCCESS', 'ERROR')), 0), 2) AS error_percent,
      ROUND(COUNT(*) FILTER (WHERE UPPER(t.status) IN ('FAIL', 'FAILED')) * 100.0 / NULLIF(COUNT(*), 0), 2) AS failed_percent,
      ROUND(AVG(t.preprocess_time_ms) / 1000.0, 1) AS pre_sec,
      ROUND(AVG(t.local_api_time_ms) / 1000.0, 1) AS local_sec,
      ROUND(AVG(t.response_time_ms) / 1000.0, 1) AS res_sec,
      ROUND(AVG(t.elapsed_time_ms) / 1000.0, 1) AS tot_sec
    FROM api_transaction t
    JOIN rcm.facility f ON f.facility_id = t.facility_id
    WHERE t.payer_id IS NOT NULL
      AND (:p1::text IS NULL OR t.creation_date >= TO_TIMESTAMP(:p1, 'YYYY-MM-DD HH24:MI'))
      AND (:p2::text IS NULL OR t.creation_date < COALESCE(TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND t.facility_id IN (:p3)
      AND (:p4::bigint IS NULL OR t.payer_id = :p4::bigint)
      AND (:p5::text IS NULL OR UPPER(t.api_name) = UPPER(:p5::text))
      AND (:p6::text IS NULL OR UPPER(t.api_provider) = UPPER(:p6::text))
      AND (:p7::text IS NULL OR UPPER(t.api_function) = UPPER(:p7::text))
      AND (:p8::text IS NULL OR UPPER(t.status) = UPPER(:p8::text))
    GROUP BY f.facility_id
  `;

  const result = await new QueryView(baseQuery, params)
    .apply({
      _sort: filters._sort || "total,desc",
      _filter: filters._filter,
      page: filters.page,
      limit: filters.limit,
    })
    .execute();
  return buildPaginatedResult(result, pageNum, limitNum);
};

export const getFacilityApiNameGrid = async (filters = {}) => {
  const {
    startDate,
    endDate,
    payerId,
    apiProvider,
    facilityIds = [-1],
    facilityId = null,
    apiFunction = null,
    status = null,
    page = 1,
    limit = 10,
  } = filters;
  const { pageNum, limitNum } = getPagination(page, limit);

  const params = {
    p1: startDate || null,
    p2: endDate || null,
    p3: facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
    p4: facilityId ? Number(facilityId) : null,
    p5: payerId ? Number(payerId) : null,
    p6: apiProvider || null,
    p7: apiFunction || null,
    p8: status || null,
  };

  console.log({startDate , endDate});

  
  const baseQuery = `
    SELECT t.api_name,
      COUNT(*) FILTER (WHERE UPPER(t.status) = 'SUCCESS') AS succeeded_count,
      COUNT(*) FILTER (WHERE UPPER(t.status) = 'ERROR') AS error_count,
      COUNT(*) FILTER (WHERE UPPER(t.status) IN ('FAIL', 'FAILED')) AS failed_count,
      COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE UPPER(t.status) = 'SUCCESS') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE UPPER(t.status) IN ('SUCCESS', 'ERROR')), 0), 2) AS succeeded_percent,
      ROUND(COUNT(*) FILTER (WHERE UPPER(t.status) = 'ERROR') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE UPPER(t.status) IN ('SUCCESS', 'ERROR')), 0), 2) AS error_percent,
      ROUND(COUNT(*) FILTER (WHERE UPPER(t.status) IN ('FAIL', 'FAILED')) * 100.0 / NULLIF(COUNT(*), 0), 2) AS failed_percent,
      ROUND(AVG(t.preprocess_time_ms) / 1000.0, 1) AS pre_sec,
      ROUND(AVG(t.local_api_time_ms) / 1000.0, 1) AS local_sec,
      ROUND(AVG(t.response_time_ms) / 1000.0, 1) AS res_sec,
      ROUND(AVG(t.elapsed_time_ms) / 1000.0, 1) AS tot_sec
    FROM api_transaction t
    JOIN rcm.facility f ON f.facility_id = t.facility_id
    WHERE t.payer_id IS NOT NULL
      AND (:p1::text IS NULL OR t.creation_date >= TO_TIMESTAMP(:p1, 'YYYY-MM-DD HH24:MI'))
      AND (:p2::text IS NULL OR t.creation_date < COALESCE(TO_TIMESTAMP(:p2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND t.facility_id IN (:p3)
      AND (:p4::bigint IS NULL OR t.facility_id = :p4::bigint)
      AND (:p5::bigint IS NULL OR t.payer_id = :p5::bigint)
      AND (:p6::text IS NULL OR UPPER(t.api_provider) = UPPER(:p6::text))
      AND (:p7::text IS NULL OR UPPER(t.api_function) = UPPER(:p7::text))
      AND (:p8::text IS NULL OR UPPER(t.status) = UPPER(:p8::text))
    GROUP BY t.api_name
  `;


  
  const result = await new QueryView(baseQuery, params)
    .apply({
      _sort: filters._sort || "total,desc",
      _filter: filters._filter,
      page: filters.page,
      limit: filters.limit,
    })
    .execute();

    

  return buildPaginatedResult(result, pageNum, limitNum);
};

export const getFacilityDailyPerformance = async (filters = {}) => {
  const { startDate, endDate, payerId, apiName, apiProvider, facilityIds = [-1], facilityId = null, apiFunction = null, status = null } = filters;

  const params = [
    startDate || null,
    endDate || null,
    facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
    facilityId ? Number(facilityId) : null,
    payerId ? Number(payerId) : null,
    apiName || null,
    apiProvider || null,
    apiFunction || null,
    status || null,
  ];
  const res = await query(
    `SELECT TO_CHAR(date_trunc('day', t.creation_date), 'DD-MM-YYYY') AS day,
      EXTRACT(EPOCH FROM date_trunc('day', t.creation_date)) AS day_ts,
      COUNT(*) FILTER (WHERE UPPER(t.status) = 'ERROR' OR t.status IS NULL) AS error_count,
      COUNT(*) FILTER (WHERE UPPER(t.status) IN ('FAIL', 'FAILED')) AS fail_count,
      COUNT(*) FILTER (WHERE UPPER(t.status) = 'SUCCESS') AS success_count,
      COUNT(*) AS total,
      ROUND(100.0 * COUNT(*) FILTER (WHERE UPPER(t.status) = 'ERROR' OR t.status IS NULL) / NULLIF(COUNT(*), 0), 2) AS error_percent,
      ROUND(100.0 * COUNT(*) FILTER (WHERE UPPER(t.status) IN ('FAIL', 'FAILED')) / NULLIF(COUNT(*), 0), 2) AS fail_percent,
      ROUND(100.0 * COUNT(*) FILTER (WHERE UPPER(t.status) = 'ERROR') / NULLIF(COUNT(*) FILTER (WHERE UPPER(t.status) IN ('ERROR', 'SUCCESS')), 0), 2) AS error_sent_percent
    FROM api_transaction t
    WHERE t.payer_id IS NOT NULL
      AND ($1::text IS NULL OR t.creation_date >= TO_TIMESTAMP($1, 'YYYY-MM-DD HH24:MI'))
      AND ($2::text IS NULL OR t.creation_date < COALESCE(TO_TIMESTAMP($2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
      AND t.facility_id = ANY($3::int[])
      AND ($4::bigint IS NULL OR t.facility_id = $4::bigint)
      AND ($5::bigint IS NULL OR t.payer_id = $5::bigint)
      AND ($6::text IS NULL OR UPPER(t.api_name) = UPPER($6::text))
      AND ($7::text IS NULL OR UPPER(t.api_provider) = UPPER($7::text))
      AND ($8::text IS NULL OR UPPER(t.api_function) = UPPER($8::text))
      AND ($9::text IS NULL OR UPPER(t.status) = UPPER($9::text))
    GROUP BY 1, 2
    ORDER BY 2 ASC`,
    params,
  );
  return { data: res.rows };
};

export const getFacilityHourlyPerformance = async (filters = {}) => {
  const { startDate, endDate, payerId, apiName, apiProvider, facilityIds = [-1], facilityId = null, apiFunction = null, status = null, dayTs = null } = filters;

  const dayCount =
    dayTs === undefined || dayTs === null || dayTs === ""
      ? Math.max(
          1,
          Math.round(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
              86400000,
          ) + 1,
        )
      : 1;
  const params = [
    startDate || null,
    endDate || null,
    facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
    facilityId ? Number(facilityId) : null,
    payerId ? Number(payerId) : null,
    apiName || null,
    apiProvider || null,
    apiFunction || null,
    status || null,
    dayCount,
    dayTs,
  ];
  const res = await query(
    `WITH hours AS (
      SELECT generate_series(0, 23) AS hour
    ),
    agg AS (
      SELECT EXTRACT(HOUR FROM t.creation_date)::int AS hour,
        COUNT(*) FILTER (WHERE UPPER(t.status) = 'ERROR' OR t.status IS NULL) AS error_count,
        COUNT(*) FILTER (WHERE UPPER(t.status) = 'ERROR') AS strict_error_count,
        COUNT(*) FILTER (WHERE UPPER(t.status) IN ('FAIL', 'FAILED')) AS fail_count,
        COUNT(*) FILTER (WHERE UPPER(t.status) = 'SUCCESS') AS success_count,
        COUNT(*) AS total
      FROM api_transaction t
      WHERE t.payer_id IS NOT NULL
        AND ($1::text IS NULL OR t.creation_date >= TO_TIMESTAMP($1, 'YYYY-MM-DD HH24:MI'))
        AND ($2::text IS NULL OR t.creation_date < COALESCE(TO_TIMESTAMP($2, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))
        AND t.facility_id = ANY($3::int[])
        AND ($4::bigint IS NULL OR t.facility_id = $4::bigint)
        AND ($5::bigint IS NULL OR t.payer_id = $5::bigint)
        AND ($6::text IS NULL OR UPPER(t.api_name) = UPPER($6::text))
        AND ($7::text IS NULL OR UPPER(t.api_provider) = UPPER($7::text))
        AND ($8::text IS NULL OR UPPER(t.api_function) = UPPER($8::text))
        AND ($9::text IS NULL OR UPPER(t.status) = UPPER($9::text))
        AND ($11::numeric IS NULL OR EXTRACT(EPOCH FROM date_trunc('day', t.creation_date)) = $11::numeric)
      GROUP BY 1
    )
    SELECT h.hour,
      COALESCE(a.error_count, 0) AS error_count,
      COALESCE(a.fail_count, 0) AS fail_count,
      COALESCE(a.success_count, 0) AS success_count,
      COALESCE(a.total, 0) AS total,
      ROUND(COALESCE(a.error_count, 0) / $10::numeric, 2) AS avg_error_count,
      ROUND(COALESCE(a.fail_count, 0) / $10::numeric, 2) AS avg_fail_count,
      ROUND(100.0 * COALESCE(a.error_count, 0) / NULLIF(COALESCE(a.total, 0), 0), 2) AS error_percent,
      ROUND(100.0 * COALESCE(a.fail_count, 0) / NULLIF(COALESCE(a.total, 0), 0), 2) AS fail_percent,
      ROUND(100.0 * COALESCE(a.strict_error_count, 0) / NULLIF(COALESCE(a.strict_error_count, 0) + COALESCE(a.success_count, 0), 0), 2) AS error_sent_percent
    FROM hours h
    LEFT JOIN agg a ON a.hour = h.hour
    ORDER BY h.hour ASC`,
    params,
  );
  return { day_count: dayCount, data: res.rows };
};
