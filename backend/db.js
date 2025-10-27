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

import mysql from "mysql2/promise";
import "dotenv/config";
import fs from 'fs';      // Keep import for now, but ensure VERCEL_ENV handles file reading
import path from 'path';  // Keep import for now

// 🚨 IMPORTANT: In a deployment environment like Vercel, 
// VERCEL_ENV will be set and we must read the CA content from an environment variable.
const isVercel = process.env.VERCEL_ENV || process.env.NODE_ENV === 'production';

// Determine SSL CA source
let caCertContent;
if (isVercel) {
    // 1. In Vercel, read the certificate string from the environment variable.
    caCertContent = process.env.DB_CA_CERT_CONTENT; 
} else {
    // 2. Locally, read the certificate from the local file path.
    const caCertPath = path.resolve(process.cwd(), 'certs', 'aiven-ca.pem');
    caCertContent = fs.readFileSync(caCertPath);
}


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  
  // === SSL CONFIGURATION ===
  ssl: caCertContent ? {
    rejectUnauthorized: true, 
    ca: caCertContent, // Pass the content, either from file (local) or ENV (Vercel)
  } : false,
  // ===============================
});

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
