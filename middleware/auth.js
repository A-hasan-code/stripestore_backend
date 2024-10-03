const jwt = require('jsonwebtoken');
const db = require('../config/db');

const isAuthenticated = async (req, res, next) => {
    const authHeader = req.cookies.token || req.headers.authorization;
    const token = authHeader.split(' ')[1]

    if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user info to request
        next();
    } catch (error) {
        res.status(401).json({ message: "Token is not valid" });
    }
};

const isAdmin = (role) => {
    return (req, res, next) => {
        if (req.user && req.user.role === role) {
            next();
        } else {
            res.status(403).json({ message: "Access denied" });
        }
    };
};

module.exports = { isAuthenticated, isAdmin };
