// todo remove 
import { Sequelize } from "sequelize";
import { config } from "./env.js";



export const sequelize = new Sequelize(
  config.DB.DATABASE,
  config.DB.USER,
  config.DB.PASSWORD,
  {
    host: config.DB.HOST,
    port: config.DB.PORT,
    dialect: "postgres",
    timezone: "Asia/Riyadh",
    logging: false,
  }
);