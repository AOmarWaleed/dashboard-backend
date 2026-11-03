import { query } from "../../config/database.js";

export const searchPatientsV2 = async ({
  search,
  identifier_value,
  gender,
  limit,
}) => {
  const conditions = [];
  const values = [];

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    conditions.push(`
      (
        p.patient_id || ' ' ||
        p.first_name || ' ' ||
        p.middle_names || ' ' ||
        p.last_name
      ) ILIKE $${values.length + 1}
    `);
    values.push(`%${trimmedSearch}%`);
  }

  if (identifier_value) {
    conditions.push(`p.identifier_value = $${values.length + 1}`);
    values.push(identifier_value);
  }

  if (gender) {
    conditions.push(`p.gender = $${values.length + 1}`);
    values.push(gender);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  let text = `
    SELECT
      p.*,
      pe.episode_no,
      pe.start_date as last_visit,
      pe.end_date,
      pe.status
    FROM Patient p
    LEFT JOIN LATERAL (
      SELECT *
      FROM rcm.patient_episode pe
      WHERE pe.patient_id = p.patient_id
      ORDER BY pe.start_date DESC
      LIMIT 1
    ) pe ON TRUE
    ${whereClause}`;

  if (limit) {
    const parsedLimit = Math.floor(Number(limit));
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      values.push(parsedLimit);
      text += ` LIMIT $${values.length}`;
    }
  }

  const { rows } = await query(text, values);
  return rows;
};

export const getAllPatientsV2 = async () => {
  const { rows } = await query("SELECT * FROM Patient LIMIT 200");
  return rows;
};
