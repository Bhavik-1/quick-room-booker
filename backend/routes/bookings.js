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

// @route   POST /api/bookings/bulk (Admin only)
// @desc    Process bulk booking upload - validates all bookings, creates non-conflicting ones immediately, returns conflicts and errors
router.post("/bulk", protect, admin, async (req, res) => {
  const { bookings } = req.body;
  const userId = req.user.id;

  if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
    return res.status(400).json({ message: "Invalid or empty bookings array." });
  }

  try {
    const created = [];
    const conflicts = [];
    const errors = [];

    // Process each booking
    for (let i = 0; i < bookings.length; i++) {
      const booking = bookings[i];
      const { room_name, date, start_time, end_time, purpose } = booking;

      // 1. Validate required fields
      if (!room_name || !date || !start_time || !end_time || !purpose) {
        const missingFields = [];
        if (!room_name) missingFields.push("room_name");
        if (!date) missingFields.push("date");
        if (!start_time) missingFields.push("start_time");
        if (!end_time) missingFields.push("end_time");
        if (!purpose) missingFields.push("purpose");
        errors.push({
          row_index: i,
          reason: `Missing required field: ${missingFields.join(", ")}`,
          booking,
        });
        continue;
      }

      // 2.Lookup room by name (case-insensitive)
      const [roomResults] = await db.query(
        "SELECT id, name FROM rooms WHERE LOWER(name) = LOWER(?)",
        [room_name.trim()]
      );

      if (roomResults.length === 0) {
        errors.push({
          row_index: i,
          reason: `Room not found: ${room_name}`,
          booking,
        });
        continue;
      }

      const room_id = roomResults[0].id;
      const room_name_normalized = roomResults[0].name;

      // 3. Validate date format (YYYY-MM-DD) and not in the past
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        errors.push({
          row_index: i,
          reason: `Invalid date format: ${date}`,
          booking,
        });
        continue;
      }

      const bookingDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (bookingDate < today) {
        errors.push({
          row_index: i,
          reason: "Date cannot be in the past",
          booking,
        });
        continue;
      }

      // 4. Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(start_time)) {
        errors.push({
          row_index: i,
          reason: `Invalid time format: ${start_time}`,
          booking,
        });
        continue;
      }
      if (!timeRegex.test(end_time)) {
        errors.push({
          row_index: i,
          reason: `Invalid time format: ${end_time}`,
          booking,
        });
        continue;
      }

      // 5. Normalize time format to HH:MM (pad single digit hours)
      const normalizeTime = (time) => {
        const [hours, minutes] = time.split(":");
        return `${hours.padStart(2, "0")}:${minutes}`;
      };
      const start_time_normalized = normalizeTime(start_time);
      const end_time_normalized = normalizeTime(end_time);

      // 6. Validate time logic: end_time must be after start_time
      if (end_time_normalized <= start_time_normalized) {
        errors.push({
          row_index: i,
          reason: "End time must be after start time",
          booking,
        });
        continue;
      }

      // 7. Calculate duration in hours
      const startParts = start_time_normalized.split(":");
      const endParts = end_time_normalized.split(":");
      const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
      const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
      const duration = (endMinutes - startMinutes) / 60;

      // 8. Check conflicts
      const isAvailable = await checkAvailability(
        room_id,
        date,
        start_time_normalized,
        end_time_normalized
      );

      if (!isAvailable) {
        // Get conflicting bookings details
        const [existingBookings] = await db.query(
          `SELECT b.id, u.name AS user_name, b.start_time, b.end_time, b.purpose
           FROM bookings b
           JOIN users u ON b.user_id = u.id
           WHERE b.room_id = ?
           AND b.date = ?
           AND b.status = 'approved'
           AND NOT (b.end_time <= ? OR b.start_time >= ?)`,
          [room_id, date, start_time_normalized, end_time_normalized]
        );

        conflicts.push({
          booking: {
            room_name: room_name_normalized,
            room_id,
            date,
            start_time: start_time_normalized,
            end_time: end_time_normalized,
            duration,
            purpose,
          },
          existing_bookings: existingBookings,
        });
        continue;
      }

      // 9. Create booking immediately (no conflicts, valid)
      const [result] = await db.query(
        "INSERT INTO bookings (user_id, room_id, date, start_time, end_time, duration, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [userId, room_id, date, start_time_normalized, end_time_normalized, duration, purpose, "approved"]
      );

      // 10. Create notification
      await db.query(
        "INSERT INTO notifications (booking_id, type, message) VALUES (?, ?, ?)",
        [result.insertId, "email", `Booking auto-approved via bulk upload.`]
      );

      created.push({
        id: result.insertId,
        room_name: room_name_normalized,
        date,
        start_time: start_time_normalized,
        end_time: end_time_normalized,
        purpose,
      });
    }

    // Return categorized results
    res.json({
      created,
      conflicts,
      errors,
      summary: {
        total: bookings.length,
        created: created.length,
        conflicts: conflicts.length,
        errors: errors.length,
      },
    });
  } catch (error) {
    console.error("Error processing bulk bookings:", error);
    res.status(500).json({ message: "Server error processing bulk bookings" });
  }
});

// @route   POST /api/bookings/bulk/resolve (Admin only)
// @desc    Process admin decisions on conflicting bookings - creates bookings with override flag
router.post("/bulk/resolve", protect, admin, async (req, res) => {
  const { resolutions } = req.body;
  const userId = req.user.id;

  if (!resolutions || !Array.isArray(resolutions) || resolutions.length === 0) {
    return res.status(400).json({ message: "Invalid or empty resolutions array." });
  }

  try {
    const created = [];
    const cancelled = [];

    for (const resolution of resolutions) {
      const { booking, action } = resolution;

      if (action === "cancel") {
        // Skip this booking
        cancelled.push({
          room_name: booking.room_name,
          date: booking.date,
          start_time: booking.start_time,
          end_time: booking.end_time,
          purpose: booking.purpose,
        });
        continue;
      }

      if (action === "override") {
        // Force-book despite conflict
        const { room_id, date, start_time, end_time, duration, purpose } = booking;

        const [result] = await db.query(
          "INSERT INTO bookings (user_id, room_id, date, start_time, end_time, duration, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [userId, room_id, date, start_time, end_time, duration, purpose, "approved"]
        );

        // Create notification
        await db.query(
          "INSERT INTO notifications (booking_id, type, message) VALUES (?, ?, ?)",
          [result.insertId, "email", `Booking force-approved by admin (override).`]
        );

        // Get room name for response
        const [roomResults] = await db.query(
          "SELECT name FROM rooms WHERE id = ?",
          [room_id]
        );

        created.push({
          id: result.insertId,
          room_name: roomResults[0]?.name || "Unknown",
          date,
          start_time,
          end_time,
          purpose,
        });
      }
    }

    res.json({
      created,
      cancelled,
    });
  } catch (error) {
    console.error("Error resolving conflicts:", error);
    res.status(500).json({ message: "Server error resolving conflicts" });
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
