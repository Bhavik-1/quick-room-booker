// backend/server.js (UPDATED)

import express from "express";
import cors from "cors";
import "dotenv/config";

// Import the database connection to ensure it starts
import db from "./db.js";

// --- Import Routes (Use default export for the router instances) ---
import authRoutes from "./routes/auth.js";
import roomsRoutes from "./routes/rooms.js"; // <--- NEW: Import the default export
import bookingsRoutes from "./routes/bookings.js"; // <--- NEW: Import the default export
import resourcesRoutes from "./routes/resources.js";

const app = express();

// Middleware
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:8080"; 

app.use(
  cors({
    origin: allowedOrigin,
  })
);
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomsRoutes); // <--- Correct variable name
app.use("/api/bookings", bookingsRoutes); // <--- Correct variable name
app.use("/api/resources", resourcesRoutes);

app.get("/", (req, res) => {
  res.send("QuickRoom API is running on " + process.env.PORT);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 QuickRoom API running on port ${PORT}`);
});
