// Migration: Add rejection_reason column to bookings table

import mysql from "mysql2/promise";
import "dotenv/config";

async function runMigration() {
  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("📦 Connected to database");

    // Check if column already exists
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM bookings LIKE 'rejection_reason'"
    );

    if (columns.length > 0) {
      console.log("✅ Column 'rejection_reason' already exists. Skipping migration.");
      return;
    }

    // Add rejection_reason column
    await connection.query(`
      ALTER TABLE bookings
      ADD COLUMN rejection_reason TEXT NULL
      AFTER status
    `);

    console.log("✅ Successfully added 'rejection_reason' column to bookings table");

    // Verify the column was added
    const [newColumns] = await connection.query(
      "SHOW COLUMNS FROM bookings LIKE 'rejection_reason'"
    );

    if (newColumns.length > 0) {
      console.log("✅ Migration verified successfully");
    }

  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("📦 Database connection closed");
    }
  }
}

runMigration();
