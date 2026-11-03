import { query } from "../config/database.js";

const criteriaConditions = (prefix = "") =>
  [
    `$1::timestamptz IS NULL OR ${prefix}creation_date >= $1::timestamptz`,
    `$2::timestamptz IS NULL OR ${prefix}creation_date <= $2::timestamptz`,
    `$3::int IS NULL OR ${prefix}payer_id = $3::int`,
    `$4::text IS NULL OR ${prefix}api_provider = $4::text`,
    `$5::text IS NULL OR ${prefix}api_name = $5::text`,
    `$6::text IS NULL OR ${prefix}api_function = $6::text`,
    `$7::text IS NULL OR ${prefix}status = $7::text`,
    `$8::int[] IS NULL OR ${prefix}facility_id = ANY($8::int[])`,
  ]
    .map((condition) => `(${condition})`)
    .join("\n      AND ");

const buildValues = (
  {
    startDate,
    endDate,
    payerId,
    apiProvider,
    apiName,
    apiFunction,
    status,
    facilityIds,
  },
  nullIndices = [],
) => {
  const values = [
    startDate ?? null,
    endDate ?? null,
    payerId ?? null,
    apiProvider ?? null,
    apiName ?? null,
    apiFunction ?? null,
    status ?? null,
    facilityIds ?? null,
  ];
  for (const i of nullIndices) values[i] = null;
  return values;
};

const PAYER_ONLY_INDICES = [2, 3, 4, 5, 6];
const PROVIDER_INDICES = [3, 4, 5, 6];
const NAME_INDICES = [4, 5, 6];
const FUNC_INDICES = [5, 6];
const STATUS_INDICES = [6];

const dimensionQuery = (column) => `
    SELECT DISTINCT
      ${column} AS value,
      ${column} AS label
    FROM api_transaction
    WHERE ${column} IS NOT NULL
      AND ${criteriaConditions()}
    ORDER BY 1
  `;

const PAYER_OPTIONS_QUERY = `
    SELECT DISTINCT
      a.payer_id AS value,
      CONCAT(a.payer_id::text, ' - ', COALESCE(p.short_name, p.description)) AS label
    FROM api_transaction a
    LEFT JOIN rcm.payer p ON p.payer_id = a.payer_id
    WHERE a.payer_id IS NOT NULL
      AND ${criteriaConditions("a.")}
    ORDER BY 1
  `;

const queryDimension = async (column, criteria, nullIndices) => {
  const { rows } = await query(
    dimensionQuery(column),
    buildValues(criteria, nullIndices),
  );
  return rows;
};

const queryPayers = async (criteria) => {
  const { rows } = await query(
    PAYER_OPTIONS_QUERY,
    buildValues(criteria, PAYER_ONLY_INDICES),
  );
  return rows;
};

export const getFilterOptions = async (criteria = {}) => {
  const [payers, providers, apiNames, apiFunctions, statuses] =
    await Promise.all([
      queryPayers(criteria),
      queryDimension("api_provider", criteria, PROVIDER_INDICES),
      queryDimension("api_name", criteria, NAME_INDICES),
      queryDimension("api_function", criteria, FUNC_INDICES),
      queryDimension("status", criteria, STATUS_INDICES),
    ]);

  return { payers, providers, apiNames, apiFunctions, statuses };
};
