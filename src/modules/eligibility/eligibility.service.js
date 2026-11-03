import { query } from "../../config/database.js";

export const getApiTrans = async (apiTransId) => {
  const { rows } = await query(
    "select * from api_transaction where api_trans_id = $1",
    [apiTransId],
  );

  return rows;
};

export const getResponseDetail = async (responseId) => {
  const { rows } = await query(
    "select * from poll_response_detail where response_id = $1",
    [responseId],
  );

  return rows;
};
