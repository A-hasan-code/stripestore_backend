const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const catchAsyncError = require('../middleware/catchAsyncError');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const ErrorHandler = require('../utils/errorHandler');
require('dotenv').config();

const router = express.Router();

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const filename = file.originalname.split(".")[0];
        cb(null, `${filename}-${uniqueSuffix}.png`);
    }
});

const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// Register user
router.post("/register", upload.single("avatar"), catchAsyncError(async (req, res, next) => {
    const { name, email, password, phoneNumber, address } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    const existingUser = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
            if (err) return reject(err);
            resolve(results[0]);
        });
    });

    if (existingUser) {
        const filename = req.file.filename;
        const filePath = path.join(__dirname, `../uploads/${filename}`);
        fs.unlink(filePath, (err) => {
            if (err) console.log(err);
        });
        return next(new ErrorHandler("User already exists", 400));
    }

    const avatar = req.file.filename;
    const hashedPassword = await bcrypt.hash(password, 10);

    await new Promise((resolve, reject) => {
        db.query('INSERT INTO users (name, email, password, phoneNumber, address, avatar) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phoneNumber, address, avatar], (err) => {
                if (err) return reject(err);
                resolve();
            });
    });

    res.status(201).json({
        success: true,
        message: "User registered successfully!",
    });
}));

// Login user
router.post("/login", catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new ErrorHandler("Please provide all fields!", 400));
    }

    const user = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
            if (err) return reject(err);
            resolve(results[0]);
        });
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return next(new ErrorHandler("Invalid credentials", 400));
    }

    const token = generateToken(user.id);

    // Set token in cookies
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: new Date(Date.now() + 3600000), // 1 hour
    });

    res.status(200).json({
        success: true,
        message: "Login successful!",
        user: { id: user.id, name: user.name, email: user.email },
        token
    });
}));

// Load user
router.get("/getuser", isAuthenticated, catchAsyncError(async (req, res, next) => {
    const user = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM users WHERE id = ?', [req.user.id], (err, results) => {
            if (err) return reject(err);
            resolve(results[0]);
        });
    });

    if (!user) {
        return next(new ErrorHandler("User doesn't exist", 400));
    }

    res.status(200).json({
        success: true,
        user
    });
}));

// Logout user
router.get('/logout', (req, res) => {
    res.clearCookie('token'); // Clear the cookie
    res.status(200).json({
        success: true,
        message: 'Logout successful!',
    });
});

// Update user info
router.put("/update-user-info", isAuthenticated, catchAsyncError(async (req, res, next) => {
    const { email, password, phoneNumber, name } = req.body;

    const user = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM users WHERE id = ?', [req.user.id], (err, results) => {
            if (err) return reject(err);
            resolve(results[0]);
        });
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return next(new ErrorHandler("Invalid credentials", 400));
    }

    await new Promise((resolve, reject) => {
        db.query('UPDATE users SET name = ?, phoneNumber = ? WHERE id = ?',
            [name, phoneNumber, user.id], (err) => {
                if (err) return reject(err);
                resolve();
            });
    });

    res.status(200).json({
        success: true,
        message: "User information updated successfully!",
    });
}));

// Update user password
router.put("/update-password", isAuthenticated, catchAsyncError(async (req, res, next) => {
    const user = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM users WHERE id = ?', [req.user.id], (err, results) => {
            if (err) return reject(err);
            resolve(results[0]);
        });
    });

    if (!user || !(await bcrypt.compare(req.body.oldPassword, user.password))) {
        return next(new ErrorHandler("Old password is incorrect!", 400));
    }

    if (req.body.newPassword !== req.body.confirmPassword) {
        return next(new ErrorHandler("Passwords do not match!", 400));
    }

    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);

    await new Promise((resolve, reject) => {
        db.query('UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, user.id], (err) => {
                if (err) return reject(err);
                resolve();
            });
    });

    res.status(200).json({
        success: true,
        message: "Password updated successfully!",
    });
}));

// Find user information by ID
router.get("/user/:id", catchAsyncError(async (req, res, next) => {
    const user = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM users WHERE id = ?', [req.params.id], (err, results) => {
            if (err) return reject(err);
            resolve(results[0]);
        });
    });

    if (!user) {
        return next(new ErrorHandler("User not found", 400));
    }

    res.status(200).json({
        success: true,
        user
    });
}));

// Admin: Get all users
router.get("/admin-all-user", isAuthenticated, isAdmin("Admin"), catchAsyncError(async (req, res, next) => {
    const users = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM users ORDER BY createdAt DESC', (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });

    res.status(200).json({
        success: true,
        users
    });
}));

module.exports = router;
