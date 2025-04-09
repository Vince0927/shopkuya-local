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
    console.log('Authenticate middleware called');
    try {
        // Get token from Authorization header or cookies
        const token = req.cookies.token ||
                     (req.headers.authorization && req.headers.authorization.split(' ')[1]);

        console.log('Cookies:', req.cookies);
        console.log('Authorization header:', req.headers.authorization);
        console.log('Token from cookies or header:', token ? 'Token found' : 'No token');

        if (!token) {
            console.log('No token provided');
            return res.status(401).json({
                error: 'Authentication Error',
                message: 'No token provided. Please log in.'
            });
        }

        // Verify token
        console.log('Verifying token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token verified, user ID:', decoded.userId);

        // Check if token exists in sessions table and is not expired
        console.log('Checking session in database...');
        const sessionResult = await db.query(
            'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (sessionResult.rows.length === 0) {
            console.log('Session not found or expired');
            return res.status(401).json({
                error: 'Authentication Error',
                message: 'Invalid or expired session. Please log in again.'
            });
        }
        console.log('Session found and valid');

        // Get user from database
        console.log('Getting user from database...');
        const userResult = await db.query(
            'SELECT id, username, email, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            console.log('User not found in database');
            return res.status(401).json({
                error: 'Authentication Error',
                message: 'User not found. Please log in again.'
            });
        }
        console.log('User found:', userResult.rows[0].username);

        // Add user to request object
        req.user = userResult.rows[0];
        console.log('Authentication successful');
        next();
    } catch (err) {
        console.error('Authentication error:', err.message);
        console.error('Error stack:', err.stack);
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
