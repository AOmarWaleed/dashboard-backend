import { query } from "../../config/database.js";

export const errorGraph = async ({
  startDate,
  endDate,
  last,
  apiName,
  apiFunction,
  apiProvider,
  status,
  dataBin = "5 minute",
  facilityIds = [-1],
}) => {
  if (startDate || endDate) last = null;

  const datequery = last
    ? `a.creation_date >= now() - $6::interval AND a.creation_date < now()`
    : `($6::text IS NULL OR a.creation_date >= TO_TIMESTAMP($6, 'YYYY-MM-DD HH24:MI')) AND ($7::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP($7, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))`;
  const facilityParam = last ? `$7::int[]` : `$8::int[]`;
  const queryParams = last
    ? [apiName, apiFunction, apiProvider, status, dataBin, last, facilityIds && facilityIds.length > 0 ? facilityIds : [-1]]
    : [
        apiName,
        apiFunction,
        apiProvider,
        status,
        dataBin,
        startDate,
        endDate,
        facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
      ];

  const result = await query(
    `
      SELECT
        date_bin($5, a.creation_date, '2000-01-01') date,
        COUNT(*) total,
        COUNT(CASE
          WHEN UPPER(a.status) = UPPER($4::text)
          THEN 1
        END) error
      FROM
        api_transaction a
      WHERE
        a.payer_id IS NOT NULL
        AND ${datequery}
        AND ($1::text IS NULL OR UPPER(a.api_name) = UPPER($1))
        AND ($2::text IS NULL OR UPPER(a.api_function) = UPPER($2))
        AND ($3::text IS NULL OR UPPER(a.api_provider) = UPPER($3))
        AND a.facility_id = ANY(${facilityParam})
      GROUP BY
        date_bin($5, a.creation_date, '2000-01-01')
      ORDER BY
        1
    `,
    queryParams,
  );

  return result.rows;
};
