// middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from Authorization header or cookies
        const token = req.cookies.token || 
                     (req.headers.authorization && req.headers.authorization.split(' ')[1]);

        if (!token) {
            return res.status(401).json({ 
                error: 'Authentication Error', 
                message: 'No token provided. Please log in.' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if token exists in sessions table and is not expired
        const sessionResult = await db.query(
            'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ 
                error: 'Authentication Error', 
                message: 'Invalid or expired session. Please log in again.' 
            });
        }

        // Get user from database
        const userResult = await db.query(
            'SELECT id, username, email, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                error: 'Authentication Error', 
                message: 'User not found. Please log in again.' 
            });
        }

        // Add user to request object
        req.user = userResult.rows[0];
        next();
    } catch (err) {
        console.error('Authentication error:', err.message);
        return res.status(401).json({ 
            error: 'Authentication Error', 
            message: 'Invalid token. Please log in again.' 
        });
    }
};

/**
 * Role-based authorization middleware
 * @param {Array} roles - Array of allowed roles
 * @returns {Function} - Express middleware function
 */
const authorize = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authorization Error', 
                message: 'You must be logged in to access this resource.' 
            });
        }

        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Authorization Error', 
                message: 'You do not have permission to access this resource.' 
            });
        }

        next();
    };
};

module.exports = {
    authenticate,
    authorize
};
