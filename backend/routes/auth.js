// backend/routes/auth.js

import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import "dotenv/config";
import db from "../db.js";
import { protect } from "../middleware/auth.js";
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to generate JWT
const generateToken = (id, email, role, name) => {
  return jwt.sign({ id, email, role, name }, JWT_SECRET, { expiresIn: "7d" });
};

// @route POST /api/auth/register
// @desc Register a new user (default: student)
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Please enter all fields" });
  }

  try {
    // Check if user exists
    const [existingUser] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Default role is 'student'
    const role = email === "admin@college.edu" ? "admin" : "student";

    // Insert new user
    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, email, password_hash, role]
    );

    const user = { id: result.insertId, name, email, role };

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token: generateToken(user.id, user.email, user.role, user.name),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// @route POST /api/auth/login
// @desc Authenticate user & get token
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    const user = users[0];

    if (user && (await bcrypt.compare(password, user.password_hash))) {
      const userWithoutHash = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      res.json({
        user: userWithoutHash,
        token: generateToken(user.id, user.email, user.role, user.name),
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// @route GET /api/auth/me
// @desc Get current logged in user details (using the token)
router.get("/me", protect, (req, res) => {
  // req.user contains the decoded JWT payload
  res.json(req.user);
});

export default router;
