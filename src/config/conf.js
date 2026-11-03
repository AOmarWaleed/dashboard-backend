import { query } from "./database.js";
import logger from "./logger.js";

const confCache = new Map();

export async function loadConf() {
  try {
    const { rows } = await query("SELECT conf_key, conf_value FROM rcm.conf");
    for (const row of rows) {
      if (!row.conf_key) continue;
      confCache.set(row.conf_key.toUpperCase(), row.conf_value);
    }
    logger.info(`Configuration loaded with ${confCache.size} entries`);
  } catch (error) {
    logger.error({ err: error }, "Failed to load configuration");
  }
}

export function getConf(key) {
  return confCache.get(key?.toUpperCase());
}

export async function updateConf(key, newValue) {
  await query("UPDATE rcm.conf SET conf_value = $1 WHERE conf_key = $2", [
    newValue,
    key?.toUpperCase(),
  ]);
  confCache.set(key?.toUpperCase(), newValue);
}

export async function reloadConfFromDB() {
  confCache.clear();
  await loadConf();
}

export async function reloadConfByKeys(...keys) {
  if (keys.length === 0) return;
  const { rows } = await query(
    "SELECT conf_key, conf_value FROM rcm.conf WHERE conf_key = ANY($1::text[])",
    [keys],
  );
  for (const row of rows) {
    if (!row.conf_key) continue;
    confCache.set(row.conf_key.toUpperCase(), row.conf_value);
  }
}
