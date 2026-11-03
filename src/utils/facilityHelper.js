import { query } from "../config/database.js";
import logger from "../config/logger.js";

export async function getDBConfByFacilityId(facilityId) {
  try {
    const result = await query(
      `SELECT 
        his_db_driver ,
        his_db_host ,
        his_db_port ,
        his_db_name ,
        his_db_username ,
        his_db_password,
        name as facility_name
      FROM facility WHERE facility_id = $1`,
      [facilityId],
    );

    const dbConfig = {
      dialect: result.rows[0]?.his_db_driver, // or "postgres", "oracle", "mssql", etc.
      host: result.rows[0]?.his_db_host,
      port: result.rows[0]?.his_db_port,
      database: result.rows[0]?.his_db_name,
      username: result.rows[0]?.his_db_username,
      password: result.rows[0]?.his_db_password,
      facility_name: result.rows[0]?.facility_name,
      facility_id: facilityId,
    };
    return dbConfig;
  } catch (error) {
    logger.error("Error fetching facility config:", error);
    throw error;
  }
}

export const getDefaultFacilityByUserId = async (userId) => {
  try {
    logger.info("Authenticated user ID: " + userId);
    if (!userId) {
      return null;
    }

    const { rows: facilities } = await query(
      `
        select 
UF.user_facility_id , UF.facility_id , UF.default_facility  , UF.user_id , UF."admin" , f.name as facility_name , f.his_db_driver , f.his_db_host , f.his_db_port , f.his_db_name , f.his_db_username , f.his_db_password , f.nphies_license
from user_facility uf
join facility f on f.facility_id  = uf.facility_id
join "user"   u on u.user_id      = uf.user_id
where u.user_id  = $1 
and (UF.default_facility = 'Y' or UF.default_facility = 'y')
;


        
        `,
      [userId],
    );
    if (!facilities || facilities.length === 0) {
      return null;
    }
    return facilities[0];
  } catch (err) {
    logger.error("Error fetching facility by user ID: " + JSON.stringify(err));
    throw err;
  }
};

export const getUserFacilityIdsByUserId = async (userId) => {
  try {
    if (!userId) return [];
    const { rows } = await query(
      `SELECT facility_id FROM user_facility WHERE user_id = $1`,
      [userId],
    );
    return rows.map((r) => r.facility_id);
  } catch (err) {
    logger.error("Error fetching user facilities: " + JSON.stringify(err));
    return [];
  }
};

