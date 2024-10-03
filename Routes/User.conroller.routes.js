const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises; // Use the promise version of fs
const db = require('../config/db'); // Assuming db is a MySQL or similar SQL database connection
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

// Utility function to query the database
const queryDatabase = (query, params) => {
    return new Promise((resolve, reject) => {
        db.query(query, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

// Register user
router.post("/register", upload.single("avatar"), catchAsyncError(async (req, res, next) => {
    const { name, email, password, phoneNumber, address } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    const existingUser = await queryDatabase('SELECT * FROM users WHERE email = ?', [email]);

    if (existingUser.length > 0) {
        const filePath = path.join(__dirname, `../uploads/${req.file.filename}`);
        await fs.unlink(filePath).catch(err => console.log(err));
        return next(new ErrorHandler("User already exists", 400));
    }

    const avatar = req.file.filename;
    const hashedPassword = await bcrypt.hash(password, 10);

    await queryDatabase('INSERT INTO users (name, email, password, phoneNumber, address, avatar) VALUES (?, ?, ?, ?, ?, ?)',
        [name, email, hashedPassword, phoneNumber, address, avatar]);

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

    const user = await queryDatabase('SELECT * FROM users WHERE email = ?', [email]);

    if (!user.length || !(await bcrypt.compare(password, user[0].password))) {
        return next(new ErrorHandler("Invalid credentials", 400));
    }

    const token = generateToken(user[0].id);

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: new Date(Date.now() + 3600000), // 1 hour
    });

    res.status(200).json({
        success: true,
        message: "Login successful!",
        user: { id: user[0].id, name: user[0].name, email: user[0].email },
        token
    });
}));

// Load user
router.get("/getuser", isAuthenticated, catchAsyncError(async (req, res, next) => {
    const user = await queryDatabase('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!user.length) {
        return next(new ErrorHandler("User doesn't exist", 404));
    }

    res.status(200).json({
        success: true,
        user: user[0]
    });
}));

// Logout user
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.status(200).json({
        success: true,
        message: 'Logout successful!',
    });
});

// Update user info
router.put("/update-user-info", isAuthenticated, catchAsyncError(async (req, res, next) => {
    const { email, password, phoneNumber, name } = req.body;

    const user = await queryDatabase('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!user.length || !(await bcrypt.compare(password, user[0].password))) {
        return next(new ErrorHandler("Invalid credentials", 400));
    }

    await queryDatabase('UPDATE users SET name = ?, phoneNumber = ? WHERE id = ?',
        [name, phoneNumber, user[0].id]);

    res.status(200).json({
        success: true,
        message: "User information updated successfully!",
    });
}));

// Update user password
router.put("/update-password", isAuthenticated, catchAsyncError(async (req, res, next) => {
    const user = await queryDatabase('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!user.length || !(await bcrypt.compare(req.body.oldPassword, user[0].password))) {
        return next(new ErrorHandler("Old password is incorrect!", 400));
    }

    if (req.body.newPassword !== req.body.confirmPassword) {
        return next(new ErrorHandler("Passwords do not match!", 400));
    }

    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);

    await queryDatabase('UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, user[0].id]);

    res.status(200).json({
        success: true,
        message: "Password updated successfully!",
    });
}));

// Find user information by ID
router.get("/user/:id", catchAsyncError(async (req, res, next) => {
    const user = await queryDatabase('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (!user.length) {
        return next(new ErrorHandler("User not found", 400));
    }

    res.status(200).json({
        success: true,
        user: user[0]
    });
}));

// Admin: Get all users
router.get("/admin-all-user", isAuthenticated, isAdmin("Admin"), catchAsyncError(async (req, res, next) => {
    const users = await queryDatabase('SELECT * FROM users ORDER BY createdAt DESC');

    res.status(200).json({
        success: true,
        users
    });
}));

module.exports = router;
