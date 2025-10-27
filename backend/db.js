// backend/db.js

// import mysql from "mysql2/promise";
// import "dotenv/config";

// // Uses variables from the .env file
// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// (async () => {
//   try {
//     await pool.query("SELECT 1");
//     console.log("✅ MySQL Database connected successfully.");
//   } catch (error) {
//     console.error("❌ Database connection failed:", error.message);
//     process.exit(1);
//   }
// })();

// export default pool;
// backend/db.js (MODIFIED FOR VERCEL DEPLOYMENT)

// backend/db.js

import mysql from "mysql2/promise";
import "dotenv/config";
import fs from "fs";
import path from "path";

// ✅ Detect if running on Vercel
const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

// ✅ Read SSL cert content
let caCertContent;
if (isVercel) {
  // In Vercel, read certificate from ENV (base64 or plain)
  caCertContent = process.env.DB_CA_CERT_CONTENT;
  if (!caCertContent) {
    console.warn("⚠️ DB_CA_CERT_CONTENT not set in Vercel environment!");
  }
} else {
  // Locally, read from file
  const caCertPath = path.resolve(process.cwd(), "certs", "aiven-ca.pem");
  caCertContent = fs.readFileSync(caCertPath, "utf-8");
}

// ✅ Create MySQL pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // ✅ SSL configuration
  ssl: caCertContent
    ? {
        rejectUnauthorized: true,
        ca: caCertContent,
      }
    : false,
});

// ✅ Test connection once on startup
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Aiven for MySQL Database connected successfully.");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
})();

export default pool;


