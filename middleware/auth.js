const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncError = require("./catchAsyncError");
const jwt = require("jsonwebtoken");
const db = require("../config/db"); // Import your db connection

// Middleware to check if user is authenticated
exports.isAuthenticated = catchAsyncError(async (req, res, next) => {
    const { token } = req.cookies;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

            // Check if user exists in the database
            db.query('SELECT * FROM users WHERE id = ?', [decoded.id], (err, results) => {
                if (err) {
                    return next(new ErrorHandler("Database query error", 500));
                }
                if (results.length === 0) {
                    return next(new ErrorHandler("User not found", 404));
                }
                req.user = results[0]; // Assuming the user object is the first result
                return next();
            });
        } catch (error) {
            return next(new ErrorHandler("Invalid or expired token", 401));
        }
    }

    return next(new ErrorHandler("Please login to continue", 401));
});

// Middleware to check if user has admin privileges
exports.isAdmin = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new ErrorHandler("Unauthorized access", 403));
        }
        next();
    };
};
