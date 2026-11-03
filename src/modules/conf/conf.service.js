import { query } from "../../config/database.js";

export const getConfValue = async (confKey) => {
  const { rows } = await query(
    "SELECT conf_key, conf_value FROM rcm.conf WHERE conf_key = $1 LIMIT 1",
    [confKey],
  );

  return rows[0] || null;
};
