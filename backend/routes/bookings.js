// backend/routes/bookings.js

import express from "express";
import db from "../db.js";
import { protect, admin } from "../middleware/auth.js";
import { checkAvailability } from "./rooms.js";
import {
  sendApprovalEmail,
  sendRejectionEmail,
  sendOverrideCancellationEmail,
} from "../services/emailService.js";

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
  const { roomId, date, startTime, endTime, duration, purpose, resources } = req.body;
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

    const bookingId = result.insertId;

    // 3. Handle resources if provided
    if (resources && Array.isArray(resources) && resources.length > 0) {
      for (const resource of resources) {
        try {
          const { resourceId, quantity } = resource;
          
          if (!resourceId || !quantity || quantity < 1) {
            console.warn(`Invalid resource data: ${JSON.stringify(resource)}`);
            continue;
          }

          // Verify resource exists
          const [resourceExists] = await db.query(
            "SELECT id FROM resources WHERE id = ?",
            [resourceId]
          );

          if (resourceExists.length === 0) {
            console.warn(`Resource ${resourceId} not found, skipping`);
            continue;
          }

          // Insert booking resource
          await db.query(
            "INSERT INTO booking_resources (booking_id, resource_id, quantity_requested) VALUES (?, ?, ?)",
            [bookingId, resourceId, quantity]
          );
        } catch (resourceError) {
          // Log but don't fail booking if resource insert fails
          console.error(`Error inserting resource: ${resourceError.message}`);
        }
      }
    }

    // 4. Trigger Notification (Simulated)
    // We'd need to fetch the room name here if we want it in the message, but we'll simplify.
    await db.query(
      "INSERT INTO notifications (booking_id, type, message) VALUES (?, ?, ?)",
      [bookingId, "email", `Your booking is pending approval.`]
    );

    res.status(201).json({
      id: bookingId,
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
    return res
      .status(400)
      .json({ message: "Invalid or empty bookings array." });
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
      const startMinutes =
        parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
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
        [
          userId,
          room_id,
          date,
          start_time_normalized,
          end_time_normalized,
          duration,
          purpose,
          "approved",
        ]
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
    return res
      .status(400)
      .json({ message: "Invalid or empty resolutions array." });
  }

  try {
    const created = [];
    const cancelled = [];
    const rejected = [];

    for (const resolution of resolutions) {
      const { booking, action, existing_bookings } = resolution;

      console.log("🔍 Processing resolution:", {
        action,
        room_name: booking.room_name,
        existing_bookings_count: existing_bookings?.length || 0,
        existing_bookings_ids: existing_bookings?.map((b) => b.id) || [],
      });

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
        const { room_id, date, start_time, end_time, duration, purpose } =
          booking;

        const [result] = await db.query(
          "INSERT INTO bookings (user_id, room_id, date, start_time, end_time, duration, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            userId,
            room_id,
            date,
            start_time,
            end_time,
            duration,
            purpose,
            "approved",
          ]
        );

        console.log("✅ New booking created:", result.insertId);

        // Create notification
        await db.query(
          "INSERT INTO notifications (booking_id, type, message) VALUES (?, ?, ?)",
          [
            result.insertId,
            "email",
            `Booking force-approved by admin (override).`,
          ]
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

        // Handle conflicting bookings - update to rejected and send emails
        console.log("🔍 Checking for conflicting bookings to update...");
        console.log(
          "existing_bookings:",
          JSON.stringify(existing_bookings, null, 2)
        );

        if (existing_bookings && existing_bookings.length > 0) {
          const conflictingBookingIds = existing_bookings.map((b) => b.id);

          console.log(
            "📋 Conflicting booking IDs to update:",
            conflictingBookingIds
          );

          // Build rejection reason with details about the new booking
          const rejectionReason = `Admin force-approved a conflicting booking by ${req.user.name} for ${purpose} on ${date} from ${start_time} to ${end_time}`;

          console.log("📝 Rejection reason:", rejectionReason);

          // Update all conflicting bookings to rejected status
          for (const conflictingId of conflictingBookingIds) {
            try {
              console.log(
                `🔄 Updating booking ${conflictingId} to rejected...`
              );

              const [updateResult] = await db.query(
                "UPDATE bookings SET status = ?, rejection_reason = ? WHERE id = ?",
                ["rejected", rejectionReason, conflictingId]
              );

              console.log(`📊 Update result for booking ${conflictingId}:`, {
                affectedRows: updateResult.affectedRows,
                changedRows: updateResult.changedRows,
                warningCount: updateResult.warningCount,
              });

              if (updateResult.affectedRows === 0) {
                console.warn(
                  `⚠️ Booking ${conflictingId} not found or already updated`
                );
              } else {
                console.log(
                  `✅ Successfully updated booking ${conflictingId} to rejected`
                );
              }
            } catch (updateError) {
              console.error(
                `❌ Failed to update booking ${conflictingId}:`,
                updateError.message
              );
              console.error("Full error:", updateError);
            }
          }

          // Fetch affected users' details for email notifications
          if (conflictingBookingIds.length > 0) {
            try {
              const placeholders = conflictingBookingIds
                .map(() => "?")
                .join(",");
              console.log(
                `🔍 Fetching affected bookings with IDs: ${conflictingBookingIds.join(
                  ", "
                )}`
              );

              const [affectedBookings] = await db.query(
                `SELECT 
                  b.id, b.room_id, b.date, b.start_time, b.end_time, b.duration, b.purpose, b.rejection_reason, b.status,
                  u.email AS user_email,
                  u.name AS user_name,
                  r.name AS room_name
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                JOIN rooms r ON b.room_id = r.id
                WHERE b.id IN (${placeholders})`,
                conflictingBookingIds
              );

              console.log(
                `📧 Found ${affectedBookings.length} affected bookings to notify`
              );
              console.log(
                "Affected bookings details:",
                affectedBookings.map((b) => ({
                  id: b.id,
                  status: b.status,
                  user_email: b.user_email,
                  room_name: b.room_name,
                }))
              );

              // Send cancellation email to each affected user
              for (const affectedBooking of affectedBookings) {
                try {
                  if (affectedBooking.user_email) {
                    console.log(
                      `📨 Sending cancellation email to ${affectedBooking.user_email} for booking ${affectedBooking.id}`
                    );

                    await sendOverrideCancellationEmail(
                      affectedBooking.user_email,
                      affectedBooking.user_name,
                      {
                        roomName: affectedBooking.room_name,
                        date: affectedBooking.date,
                        startTime: affectedBooking.start_time,
                        endTime: affectedBooking.end_time,
                        duration: affectedBooking.duration,
                        purpose: affectedBooking.purpose,
                      },
                      {
                        adminName: req.user.name,
                        purpose: purpose,
                        date: date,
                        startTime: start_time,
                        endTime: end_time,
                      }
                    );

                    console.log(
                      `✅ Email sent successfully for booking ${affectedBooking.id}`
                    );

                    rejected.push({
                      id: affectedBooking.id,
                      user_name: affectedBooking.user_name,
                      room_name: affectedBooking.room_name,
                      date: affectedBooking.date,
                      start_time: affectedBooking.start_time,
                      end_time: affectedBooking.end_time,
                    });
                  } else {
                    console.warn(
                      `⚠️ User email not found for booking ${affectedBooking.id}`
                    );
                  }
                } catch (emailError) {
                  console.error(
                    `❌ Failed to send email for booking ${affectedBooking.id}:`,
                    emailError.message
                  );
                }
              }
            } catch (fetchError) {
              console.error(
                "❌ Failed to fetch affected bookings:",
                fetchError.message
              );
              console.error("Full error:", fetchError);
            }
          }
        } else {
          console.log("ℹ️ No existing_bookings to update (empty or undefined)");
        }
      }
    }

    console.log("📦 Final response:", {
      created_count: created.length,
      cancelled_count: cancelled.length,
      rejected_count: rejected.length,
      rejected_ids: rejected.map((r) => r.id),
    });

    res.json({
      created,
      cancelled,
      rejected,
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
  const { status, rejection_reason } = req.body;
  const { id } = req.params;

  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ message: "Invalid status provided." });
  }

  try {
    // Update booking status with conditional rejection_reason handling
    let updateQuery;
    let updateParams;

    if (status === "rejected" && rejection_reason) {
      updateQuery =
        "UPDATE bookings SET status = ?, rejection_reason = ? WHERE id = ?";
      updateParams = [status, rejection_reason, id];
    } else if (status === "rejected") {
      updateQuery =
        "UPDATE bookings SET status = ?, rejection_reason = NULL WHERE id = ?";
      updateParams = [status, id];
    } else {
      // status is "approved"
      updateQuery = "UPDATE bookings SET status = ? WHERE id = ?";
      updateParams = [status, id];
    }

    const [result] = await db.query(updateQuery, updateParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Fetch user email and booking details for email notification
    const [rows] = await db.query(
      `SELECT 
        b.room_id, b.date, b.start_time, b.end_time, b.duration, b.purpose, b.rejection_reason,
        u.email AS user_email,
        u.name AS user_name,
        r.name AS room_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      console.error(`Booking ${id} not found after update`);
      return res.status(404).json({ message: "Booking not found" });
    }

    const bookingData = rows[0];

    // ⚡ NEW: If approving, check for conflicts with existing approved bookings and override them
    const rejectedBookings = [];

    if (status === "approved") {
      console.log(
        `\n🔍 [Approval Override] Checking for conflicts for booking ${id}...`
      );

      try {
        // Query for conflicting approved bookings
        const [conflictingBookings] = await db.query(
          `SELECT b.id, u.name AS user_name, u.email AS user_email, b.start_time, b.end_time, b.purpose,
                  r.name AS room_name, b.date, b.duration
           FROM bookings b
           JOIN users u ON b.user_id = u.id
           JOIN rooms r ON b.room_id = r.id
           WHERE b.room_id = ?
           AND b.date = ?
           AND b.status = 'approved'
           AND b.id != ?
           AND NOT (b.end_time <= ? OR b.start_time >= ?)`,
          [
            bookingData.room_id,
            bookingData.date,
            id,
            bookingData.start_time,
            bookingData.end_time,
          ]
        );

        console.log(
          `📋 Found ${conflictingBookings.length} conflicting approved booking(s)`
        );

        if (conflictingBookings.length > 0) {
          console.log(
            "Conflicting booking IDs:",
            conflictingBookings.map((b) => b.id)
          );

          // Build rejection reason
          const rejectionReason = `Admin force-approved a conflicting booking by ${req.user.name} for ${bookingData.purpose} on ${bookingData.date} from ${bookingData.start_time} to ${bookingData.end_time}`;

          // Update each conflicting booking to rejected
          for (const conflictingBooking of conflictingBookings) {
            try {
              console.log(
                `🔄 Updating conflicting booking ${conflictingBooking.id} to rejected...`
              );

              const [updateResult] = await db.query(
                "UPDATE bookings SET status = ?, rejection_reason = ? WHERE id = ?",
                ["rejected", rejectionReason, conflictingBooking.id]
              );

              console.log(`📊 Update result:`, {
                id: conflictingBooking.id,
                affectedRows: updateResult.affectedRows,
                changedRows: updateResult.changedRows,
              });

              if (updateResult.affectedRows > 0) {
                // Send cancellation email to affected user
                try {
                  if (conflictingBooking.user_email) {
                    console.log(
                      `📨 Sending override cancellation email to ${conflictingBooking.user_email}`
                    );

                    await sendOverrideCancellationEmail(
                      conflictingBooking.user_email,
                      conflictingBooking.user_name,
                      {
                        roomName: conflictingBooking.room_name,
                        date: conflictingBooking.date,
                        startTime: conflictingBooking.start_time,
                        endTime: conflictingBooking.end_time,
                        duration: conflictingBooking.duration,
                        purpose: conflictingBooking.purpose,
                      },
                      {
                        adminName: req.user.name,
                        purpose: bookingData.purpose,
                        date: bookingData.date,
                        startTime: bookingData.start_time,
                        endTime: bookingData.end_time,
                      }
                    );

                    console.log(
                      `✅ Override cancellation email sent for booking ${conflictingBooking.id}`
                    );

                    rejectedBookings.push({
                      id: conflictingBooking.id,
                      user_name: conflictingBooking.user_name,
                      room_name: conflictingBooking.room_name,
                    });
                  } else {
                    console.warn(
                      `⚠️ No email found for user of booking ${conflictingBooking.id}`
                    );
                  }
                } catch (emailError) {
                  console.error(
                    `❌ Failed to send override email for booking ${conflictingBooking.id}:`,
                    emailError.message
                  );
                }
              } else {
                console.warn(
                  `⚠️ Conflicting booking ${conflictingBooking.id} not updated (may not exist)`
                );
              }
            } catch (updateError) {
              console.error(
                `❌ Failed to update conflicting booking ${conflictingBooking.id}:`,
                updateError.message
              );
            }
          }

          console.log(
            `✅ Override complete: ${rejectedBookings.length} booking(s) rejected and notified\n`
          );
        } else {
          console.log("✅ No conflicts found, approval is clean\n");
        }
      } catch (conflictError) {
        console.error(
          "❌ Error checking for conflicts:",
          conflictError.message
        );
        // Don't fail the entire approval if conflict check fails
      }
    }

    // Send appropriate email based on status
    try {
      if (status === "approved") {
        await sendApprovalEmail(bookingData.user_email, bookingData.user_name, {
          roomName: bookingData.room_name,
          date: bookingData.date,
          startTime: bookingData.start_time,
          endTime: bookingData.end_time,
          duration: bookingData.duration,
          purpose: bookingData.purpose,
        });
      } else if (status === "rejected") {
        await sendRejectionEmail(
          bookingData.user_email,
          bookingData.user_name,
          {
            roomName: bookingData.room_name,
            date: bookingData.date,
            startTime: bookingData.start_time,
            endTime: bookingData.end_time,
            duration: bookingData.duration,
            purpose: bookingData.purpose,
          },
          bookingData.rejection_reason
        );
      }
    } catch (emailError) {
      // Log email error but don't fail the entire operation
      console.error(
        `Failed to send email for booking ${id}:`,
        emailError.message
      );
    }

    // Include rejected bookings info in response for transparency
    const responseMessage =
      rejectedBookings.length > 0
        ? `Booking ${id} ${status} successfully. ${rejectedBookings.length} conflicting booking(s) were automatically rejected.`
        : `Booking ${id} ${status} successfully`;

    res.json({
      message: responseMessage,
      rejectedBookings:
        rejectedBookings.length > 0 ? rejectedBookings : undefined,
    });
  } catch (error) {
    console.error(`Error updating booking ${id} status:`, error);
    res.status(500).json({ message: "Server error updating booking status" });
  }
});

// @route   PUT /api/bookings/:id (Student/User)
// @desc    Update own pending booking
router.put("/:id", protect, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { roomId, date, startTime, endTime, duration, purpose } = req.body;

  try {
    // 1. Fetch existing booking
    const [bookings] = await db.query("SELECT * FROM bookings WHERE id = ?", [
      id,
    ]);

    if (bookings.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const existingBooking = bookings[0];

    // 2. Verify ownership
    if (existingBooking.user_id !== userId) {
      return res.status(403).json({
        message: "Unauthorized - You can only edit your own bookings",
      });
    }

    // 3. Verify status is pending
    if (existingBooking.status !== "pending") {
      return res.status(403).json({
        message: "Only pending bookings can be edited",
      });
    }

    // 4. Merge with existing data (use new values if provided, otherwise keep old)
    const updatedRoomId = roomId || existingBooking.room_id;
    const updatedDate = date || existingBooking.date;
    const updatedStartTime = startTime || existingBooking.start_time;
    const updatedEndTime = endTime || existingBooking.end_time;
    const updatedDuration =
      duration !== undefined ? duration : existingBooking.duration;
    const updatedPurpose = purpose || existingBooking.purpose;

    // 5. Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(updatedDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // 6. Validate date not in past
    const bookingDate = new Date(updatedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({ message: "Cannot book dates in the past" });
    }

    // 7. Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(updatedStartTime)) {
      return res.status(400).json({ message: "Invalid time format" });
    }
    if (!timeRegex.test(updatedEndTime)) {
      return res.status(400).json({ message: "Invalid time format" });
    }

    // 8. Validate time logic
    if (updatedEndTime <= updatedStartTime) {
      return res.status(400).json({
        message: "End time must be after start time",
      });
    }

    // 9. Verify room exists
    const [rooms] = await db.query("SELECT id FROM rooms WHERE id = ?", [
      updatedRoomId,
    ]);
    if (rooms.length === 0) {
      return res.status(400).json({ message: "Room no longer exists" });
    }

    // 10. Check for conflicts (excluding current booking)
    const [conflicts] = await db.query(
      `SELECT COUNT(*) as count 
       FROM bookings 
       WHERE room_id = ? 
         AND date = ? 
         AND status = 'approved'
         AND id != ?
         AND NOT (end_time <= ? OR start_time >= ?)`,
      [updatedRoomId, updatedDate, id, updatedStartTime, updatedEndTime]
    );

    if (conflicts[0].count > 0) {
      return res.status(409).json({
        message: "This time slot is no longer available",
      });
    }

    // 11. Update booking
    await db.query(
      `UPDATE bookings 
       SET room_id = ?, date = ?, start_time = ?, end_time = ?, duration = ?, purpose = ? 
       WHERE id = ?`,
      [
        updatedRoomId,
        updatedDate,
        updatedStartTime,
        updatedEndTime,
        updatedDuration,
        updatedPurpose,
        id,
      ]
    );

    // 12. Fetch updated booking with room name
    const [updatedBookings] = await db.query(
      `SELECT b.*, r.name AS room_name
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       WHERE b.id = ?`,
      [id]
    );

    res.json({
      message: "Booking updated successfully",
      booking: updatedBookings[0],
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ message: "Server error updating booking" });
  }
});

// @route   DELETE /api/bookings/:id (Student/User)
// @desc    Delete own pending booking
router.delete("/:id", protect, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // 1. Fetch existing booking
    const [bookings] = await db.query("SELECT * FROM bookings WHERE id = ?", [
      id,
    ]);

    if (bookings.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const existingBooking = bookings[0];

    // 2. Verify ownership
    if (existingBooking.user_id !== userId) {
      return res.status(403).json({
        message: "Unauthorized - You can only delete your own bookings",
      });
    }

    // 3. Verify status is pending
    if (existingBooking.status !== "pending") {
      return res.status(403).json({
        message: "Only pending bookings can be deleted",
      });
    }

    // 4. Delete booking
    await db.query("DELETE FROM bookings WHERE id = ?", [id]);

    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ message: "Server error deleting booking" });
  }
});

// GET /bookings  -> if ?admin=true then return all bookings with extra details (only for admins)
router.get("/", async (req, res) => {
  try {
    const isAdminQuery = req.query.admin === "true";
    if (isAdminQuery) {
      // ensure user is admin (assumes auth middleware set req.user)
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      // return full booking details (join with users/rooms as needed)
      const rows = await db.getAllBookingsWithDetails(); // implement this helper in db.js
      return res.json(rows);
    }

    // default: return bookings visible to the caller (student)
    const rows = await db.getBookingsForUser(req.user ? req.user.id : null);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
