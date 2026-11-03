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

  if (!last && !endDate) endDate = new Date();

  const datequery = last ? `now() - $6::interval AND now()` : `$6 AND $7`;
  const facilityParam = last ? `$7::int[]` : `$8::int[]`;
  const queryParams = last
    ? [apiName, apiFunction, apiProvider, status, dataBin, last, facilityIds]
    : [
        apiName,
        apiFunction,
        apiProvider,
        status,
        dataBin,
        startDate,
        endDate,
        facilityIds,
      ];

  const result = await query(
    `
      SELECT
        date_bin($5, a.creation_date, '2000-01-01') date,
        COUNT(*) total,
        COUNT(CASE
          WHEN a.status IN ('ERROR', 'FAILED') OR a.status IS NULL
          THEN 1
        END) error
      FROM
        api_transaction a
      WHERE
        a.creation_date BETWEEN ${datequery}
        AND ($1::text IS NULL OR a.api_name = $1)
        AND ($2::text IS NULL OR a.api_function = $2)
        AND ($3::text IS NULL OR a.api_provider = $3)
        AND ($4::text IS NULL OR a.status = $4)
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
