// backend/routes/rooms.js

import express from "express";
import db from "../db.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

// --- Helper Function (Copied from bookings.js for shared logic) ---
async function checkAvailability(
  roomId,
  date,
  startTime,
  endTime,
  excludeBookingId = null
) {
  const query = `
        SELECT id FROM bookings
        WHERE room_id = ?
        AND date = ?
        AND status = 'approved'
        AND NOT (end_time <= ? OR start_time >= ?)
        ${excludeBookingId ? "AND id != ?" : ""}
    `;
  const params = [roomId, date, startTime, endTime];
  if (excludeBookingId) {
    params.push(excludeBookingId);
  }

  const [conflictingBookings] = await db.query(query, params);
  return conflictingBookings.length === 0;
}

// @route   GET /api/rooms
// @desc    Get all rooms (Available to all authenticated users)
router.get("/", protect, async (req, res) => {
  try {
    // UPDATED SELECT: Removed facilities
    const [rooms] = await db.query(
      "SELECT id, name, capacity, type FROM rooms"
    );

    // Simplfied mapping as no JSON parsing is needed for this data set
    const formattedRooms = rooms.map((room) => ({
      ...room,
      id: String(room.id),
    }));

    res.json(formattedRooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ message: "Server error fetching rooms" });
  }
});

// @route   POST /api/rooms (Admin only) - Corresponds to Room.addRoom()
// @desc    Add a new room
router.post("/", protect, admin, async (req, res) => {
  // UPDATED PAYLOAD: Facilities omitted from req.body destructuring
  const { name, capacity, type = "General" } = req.body;
  if (!name || !capacity) {
    return res.status(400).json({ message: "Name and capacity are required." });
  }

  try {
    // UPDATED INSERT: Removed facilities column
    const [result] = await db.query(
      "INSERT INTO rooms (name, capacity, type) VALUES (?, ?, ?)",
      [name, capacity, type]
    );

    // Send back minimal response object
    res.status(201).json({ id: result.insertId, name, capacity, type });
  } catch (error) {
    console.error("Error adding room:", error);
    res.status(500).json({ message: "Server error adding room" });
  }
});

// @route   PUT /api/rooms/:id (Admin only) - Corresponds to Room.editRoom()
// @desc    Update a room
router.put("/:id", protect, admin, async (req, res) => {
  // UPDATED PAYLOAD: Facilities omitted from req.body destructuring
  const { name, capacity, type } = req.body;
  const { id } = req.params;

  try {
    // Build the update query dynamically
    let updates = [];
    let params = [];
    if (name) {
      updates.push("name = ?");
      params.push(name);
    }
    if (capacity) {
      updates.push("capacity = ?");
      params.push(capacity);
    }
    // Facilities JSON block removed
    if (type) {
      updates.push("type = ?");
      params.push(type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }

    const query = `UPDATE rooms SET ${updates.join(", ")} WHERE id = ?`;
    params.push(id);

    await db.query(query, params);
    res.json({ message: "Room updated successfully" });
  } catch (error) {
    console.error("Error updating room:", error);
    res.status(500).json({ message: "Server error updating room" });
  }
});

// @route   DELETE /api/rooms/:id (Admin only) - Corresponds to Room.deleteRoom()
// @desc    Delete a room
router.delete("/:id", protect, admin, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM rooms WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ message: "Server error deleting room" });
  }
});

export { router as roomsRouter, checkAvailability };
export default router;

