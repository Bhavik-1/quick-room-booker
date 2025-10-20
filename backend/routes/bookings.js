// backend/routes/bookings.js

import express from "express";
import db from "../db.js";
import { protect, admin } from "../middleware/auth.js";
import { checkAvailability } from "./rooms.js";

const router = express.Router();

// --- Helper Query Segment for Joining Data (FIXED: Removed b.created_at) ---
// This selects all booking fields, plus the names from joined tables
const BOOKING_SELECT_FIELDS = `
    b.id, b.user_id, b.room_id, b.date, b.start_time, b.end_time, b.duration, b.purpose, b.status, 
    u.name AS user_name,
    r.name AS room_name
`;
const BOOKING_JOIN_CLAUSE = `
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN rooms r ON b.room_id = r.id
`;

// @route   POST /api/bookings (Student/User) - Corresponds to Booking.createBooking()
// @desc    Create a new booking request
router.post("/", protect, async (req, res) => {
  // Note: roomName and userName are calculated on the backend now.
  const { roomId, date, startTime, endTime, duration, purpose } = req.body;
  const userId = req.user.id;
  // req.user.name is available for notification trigger if needed

  if (!roomId || !date || !startTime || !endTime || !purpose) {
    return res
      .status(400)
      .json({ message: "Missing required booking fields." });
  }

  try {
    // 1. Conflict Detection
    const isAvailable = await checkAvailability(
      roomId,
      date,
      startTime,
      endTime
    );
    if (!isAvailable) {
      return res.status(409).json({
        message:
          "Conflict Detected: Room is already booked during this time slot.",
      });
    }

    // 2. Create Booking (Only inserting columns that exist in the table)
    const [result] = await db.query(
      "INSERT INTO bookings (user_id, room_id, date, start_time, end_time, duration, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [userId, roomId, date, startTime, endTime, duration, purpose, "pending"]
    );

    // 3. Trigger Notification (Simulated)
    // We'd need to fetch the room name here if we want it in the message, but we'll simplify.
    await db.query(
      "INSERT INTO notifications (booking_id, type, message) VALUES (?, ?, ?)",
      [result.insertId, "email", `Your booking is pending approval.`]
    );

    res.status(201).json({
      id: result.insertId,
      message: "Booking request submitted successfully! Pending approval.",
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Server error creating booking" });
  }
});

// @route   GET /api/bookings/my (Student/User)
// @desc    Get bookings for the logged-in user
router.get("/my", protect, async (req, res) => {
  try {
    const query = `
            SELECT ${BOOKING_SELECT_FIELDS}
            ${BOOKING_JOIN_CLAUSE}
            WHERE b.user_id = ? 
            ORDER BY b.date DESC, b.start_time DESC
        `;
    const [bookings] = await db.query(query, [req.user.id]);
    res.json(bookings);
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ message: "Server error fetching user bookings" });
  }
});

// @route   GET /api/bookings/all (Admin only)
// @desc    Get all bookings (including pending, approved, rejected)
router.get("/all", protect, admin, async (req, res) => {
  try {
    const query = `
            SELECT ${BOOKING_SELECT_FIELDS}
            ${BOOKING_JOIN_CLAUSE}
            ORDER BY b.date ASC, b.start_time ASC
        `;
    const [bookings] = await db.query(query);
    res.json(bookings);
  } catch (error) {
    console.error("Error fetching all bookings:", error);
    res.status(500).json({ message: "Server error fetching all bookings" });
  }
});

// @route   GET /api/bookings/visible
// @desc    Returns the user's own bookings + anonymized approved bookings from others
router.get("/visible", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT ${BOOKING_SELECT_FIELDS}
      ${BOOKING_JOIN_CLAUSE}
      ORDER BY b.date DESC, b.start_time DESC
    `;

    const [allBookings] = await db.query(query);

    const visibleBookings = allBookings
      .map((b) => {
        if (b.user_id === userId) {
          // Full details for user's own bookings
          return b;
        } else if (b.status === "approved") {
          // Hide personal details for others' approved bookings
          return {
            id: b.id,
            room_name: b.room_name,
            date: b.date,
            start_time: b.start_time,
            end_time: b.end_time,
            duration: b.duration,
            status: "booked",
            purpose: "Not available",
            user_name: "Booked",
          };
        }
        // Do not show others' pending/rejected bookings
        return null;
      })
      .filter(Boolean);

    res.json(visibleBookings);
  } catch (error) {
    console.error("Error fetching visible bookings:", error);
    res.status(500).json({ message: "Server error fetching visible bookings" });
  }
});

// @route   PUT /api/bookings/:id/status (Admin only) - Approve/Reject
// @desc    Update a booking status
router.put("/:id/status", protect, admin, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ message: "Invalid status provided." });
  }

  try {
    const [result] = await db.query(
      "UPDATE bookings SET status = ? WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Trigger Notification on status change
    await db.query(
      "INSERT INTO notifications (booking_id, type, message) VALUES (?, ?, ?)",
      [id, "email", `Your booking status has been updated to ${status}.`]
    );

    res.json({ message: `Booking ${id} ${status} successfully` });
  } catch (error) {
    console.error(`Error updating booking ${id} status:`, error);
    res.status(500).json({ message: "Server error updating booking status" });
  }
});

export default router;
