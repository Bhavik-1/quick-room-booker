// backend/routes/resources.js

import express from "express";
import db from "../db.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

// @route   GET /api/resources
// @desc    Get all resources (Available to all authenticated users)
router.get("/", protect, async (req, res) => {
  try {
    const [resources] = await db.query(
      "SELECT id, name, type, total_quantity FROM resources ORDER BY type ASC, name ASC"
    );

    const formattedResources = resources.map((resource) => ({
      ...resource,
      id: String(resource.id),
    }));

    res.json(formattedResources);
  } catch (error) {
    console.error("Error fetching resources:", error);
    res.status(500).json({ message: "Server error fetching resources" });
  }
});

// @route   POST /api/resources (Admin only)
// @desc    Add a new resource
router.post("/", protect, admin, async (req, res) => {
  const { name, type, total_quantity } = req.body;

  if (!name || !type || total_quantity === undefined) {
    return res.status(400).json({ message: "Name, type, and total quantity are required" });
  }

  if (total_quantity < 1) {
    return res.status(400).json({ message: "Quantity must be at least 1" });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO resources (name, type, total_quantity) VALUES (?, ?, ?)",
      [name, type, total_quantity]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      type,
      total_quantity
    });
  } catch (error) {
    console.error("Error adding resource:", error);
    res.status(500).json({ message: "Server error adding resource" });
  }
});

// @route   PUT /api/resources/:id (Admin only)
// @desc    Update a resource
router.put("/:id", protect, admin, async (req, res) => {
  const { name, type, total_quantity } = req.body;
  const { id } = req.params;

  try {
    // Validate total_quantity if provided
    if (total_quantity !== undefined && total_quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    // Build the update query dynamically
    let updates = [];
    let params = [];
    if (name) {
      updates.push("name = ?");
      params.push(name);
    }
    if (type) {
      updates.push("type = ?");
      params.push(type);
    }
    if (total_quantity !== undefined) {
      updates.push("total_quantity = ?");
      params.push(total_quantity);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const query = `UPDATE resources SET ${updates.join(", ")} WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Resource not found" });
    }

    res.json({ message: "Resource updated successfully" });
  } catch (error) {
    console.error("Error updating resource:", error);
    res.status(500).json({ message: "Server error updating resource" });
  }
});

// @route   DELETE /api/resources/:id (Admin only)
// @desc    Delete a resource
router.delete("/:id", protect, admin, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM resources WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Resource not found" });
    }

    res.json({ message: "Resource deleted successfully" });
  } catch (error) {
    console.error("Error deleting resource:", error);
    res.status(500).json({ message: "Server error deleting resource" });
  }
});

// @route   POST /api/resources/check-availability
// @desc    Check resource availability for specific date/time
router.post("/check-availability", protect, async (req, res) => {
  const { resources, date, startTime, endTime } = req.body;

  if (!resources || !date || !startTime || !endTime) {
    return res.status(400).json({ message: "Resources, date, start time, and end time are required" });
  }

  if (!Array.isArray(resources) || resources.length === 0) {
    return res.status(400).json({ message: "Resources must be a non-empty array" });
  }

  try {
    const availabilityResults = [];
    let allAvailable = true;

    for (const resource of resources) {
      const { resourceId, quantity } = resource;

      if (!resourceId || !quantity) {
        continue;
      }

      // Get total quantity for this resource
      const [resourceData] = await db.query(
        "SELECT id, name, total_quantity FROM resources WHERE id = ?",
        [resourceId]
      );

      if (resourceData.length === 0) {
        continue;
      }

      const resourceInfo = resourceData[0];
      const totalQuantity = resourceInfo.total_quantity;

      // Query booking_resources for overlapping approved bookings
      const [usedResources] = await db.query(
        `SELECT SUM(br.quantity_requested) as used_quantity
         FROM booking_resources br
         JOIN bookings b ON br.booking_id = b.id
         WHERE br.resource_id = ?
           AND b.date = ?
           AND b.status = 'approved'
           AND NOT (b.end_time <= ? OR b.start_time >= ?)`,
        [resourceId, date, startTime, endTime]
      );

      const usedQuantity = usedResources[0]?.used_quantity || 0;
      const available = totalQuantity - usedQuantity;
      const sufficient = quantity <= available;

      if (!sufficient) {
        allAvailable = false;
      }

      availabilityResults.push({
        resourceId: String(resourceId),
        resourceName: resourceInfo.name,
        requested: quantity,
        available: available,
        sufficient: sufficient,
      });
    }

    res.json({
      available: allAvailable,
      resources: availabilityResults,
    });
  } catch (error) {
    console.error("Error checking resource availability:", error);
    res.status(500).json({ message: "Server error checking availability" });
  }
});

export default router;
