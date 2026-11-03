import dayjs from "./dayjs.js";

export const convertDateTimeByTimezone = (datetime, tz) =>
  dayjs.tz(datetime, tz).utc().format("YYYY-MM-DD HH:mm");

export const formatRiyadhTimestamp = (value) => {
  if (!value) return value;

  return dayjs
    .utc(value, "DD-MM-YYYY HH:mm:ss")
    .tz("Asia/Riyadh")
    .format("DD-MM-YYYY HH:mm:ss");
};
