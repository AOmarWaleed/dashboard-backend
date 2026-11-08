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
  statuses,
}) => {
  try {
    if (startDate || endDate) last = null;

    const backendStatusResult = await query(`
      SELECT DISTINCT
      status AS value,
      status AS label
    FROM api_transaction
    WHERE status IS NOT NULL
    ORDER BY 1`);

    const backendStatuses = backendStatusResult.rows
      .filter((status) => status.value)
      .map((status) => status.value);

    // Half-open range: start <= creation_date < end.
    const datequery = last
      ? `a.creation_date >= now() - $5::interval AND a.creation_date < now()`
      : `($5::text IS NULL OR a.creation_date >= TO_TIMESTAMP($5, 'YYYY-MM-DD HH24:MI')) AND ($6::text IS NULL OR a.creation_date < COALESCE(TO_TIMESTAMP($6, 'YYYY-MM-DD HH24:MI'), '9999-01-01 00:00'::timestamp))`;
    const facilityParam = last ? `$6::int[]` : `$7::int[]`;

    // The client can either select a single status, provide multiple statuses
    // through the adaptive filter, or leave the status filter empty to retrieve
    // data for all statuses.
    const selectedStatuses = status
      ? [status]
      : statuses?.length
        ? statuses
        : backendStatuses;

    const queryParams = last
      ? [
          apiName,
          apiFunction,
          apiProvider,
          status,
          dataBin,
          last,
          facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
          ...selectedStatuses,
        ]
      : [
          apiName,
          apiFunction,
          apiProvider,
          dataBin,
          startDate,
          endDate,
          facilityIds && facilityIds.length > 0 ? facilityIds : [-1],
          ...selectedStatuses,
        ];

    // The offset variable tracks the next query parameter position,
    // since the number of parameters varies depending on the 'last' variable.
    const offset = last ? 7 : 8;
    const statusColumns = selectedStatuses
      .map(
        (status, index) => `COUNT(
      CASE
        WHEN a.status = UPPER($${index + offset}::text)
        THEN 1
      END
    ) AS "${status.toLowerCase()}"`,
      )
      .join(", ");

    const result = await query(
      `
      SELECT
        date_bin($4, a.creation_date, '2000-01-01') date,
        COUNT(*) total,
        ${statusColumns}
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
        date_bin($4, a.creation_date, '2000-01-01')
      ORDER BY
        1
    `,
      queryParams,
    );
    return result.rows;
  } catch (error) {
    console.log(error);
  }
};
