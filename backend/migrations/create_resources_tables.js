// Migration: Create resources and booking_resources tables

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

    // Check if resources table already exists
    const [resourcesTables] = await connection.query(
      "SHOW TABLES LIKE 'resources'"
    );

    if (resourcesTables.length > 0) {
      console.log("✅ Table 'resources' already exists. Skipping resources table creation.");
    } else {
      // Create resources table
      await connection.query(`
        CREATE TABLE resources (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          total_quantity INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      console.log("✅ Successfully created 'resources' table");
    }

    // Check if booking_resources table already exists
    const [bookingResourcesTables] = await connection.query(
      "SHOW TABLES LIKE 'booking_resources'"
    );

    if (bookingResourcesTables.length > 0) {
      console.log("✅ Table 'booking_resources' already exists. Skipping booking_resources table creation.");
    } else {
      // Create booking_resources junction table
      await connection.query(`
        CREATE TABLE booking_resources (
          id INT AUTO_INCREMENT PRIMARY KEY,
          booking_id INT NOT NULL,
          resource_id INT NOT NULL,
          quantity_requested INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY booking_resource (booking_id, resource_id),
          INDEX idx_booking_id (booking_id),
          INDEX idx_resource_id (resource_id),
          FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
          FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
        )
      `);

      console.log("✅ Successfully created 'booking_resources' table");
    }

    // Verify tables were created
    const [verifyResources] = await connection.query(
      "SHOW TABLES LIKE 'resources'"
    );
    const [verifyBookingResources] = await connection.query(
      "SHOW TABLES LIKE 'booking_resources'"
    );

    if (verifyResources.length > 0 && verifyBookingResources.length > 0) {
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
