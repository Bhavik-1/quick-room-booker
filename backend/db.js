// backend/db.js

import mysql from "mysql2/promise";
import "dotenv/config";

// Uses variables from the .env file
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ MySQL Database connected successfully.");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
})();

export default pool;
