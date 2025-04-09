// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const cookieParser = require('cookie-parser');
const emailService = require('../services/emailService');

/**
 * GET /api/auth/me - Get current authenticated user
 */
router.get('/me', authenticate, (req, res) => {
    try {
        // User is already attached to req by the authenticate middleware
        res.json(req.user);
    } catch (err) {
        console.error('Error in auth/me endpoint:', err.message);
        res.status(500).json({
            error: 'Authentication Error',
            message: 'Failed to authenticate user.'
        });
    }
});

/**
 * POST /api/auth/register - Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role = 'user' } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Username, email, and password are required.'
            });
        }

        // Check if username or email already exists
        const existingUser = await db.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'Registration Error',
                message: 'Username or email already exists.'
            });
        }

        // Validate role
        if (!['user', 'seller', 'admin'].includes(role)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid role. Role must be one of: user, seller, admin.'
            });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const result = await db.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
            [username, email, passwordHash, role]
        );

        const newUser = result.rows[0];

        // Generate verification token
        const token = crypto.randomBytes(32).toString('hex');

        // Calculate expiration (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Store token in database
        await db.query(
            'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [newUser.id, token, expiresAt]
        );

        // Send verification email
        try {
            await emailService.sendWelcomeEmail(email, token, username);
            console.log(`Verification email sent to ${email}`);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Continue with registration even if email fails
        }

        res.status(201).json({
            message: 'User registered successfully. Please check your email to verify your account.',
            user: newUser
        });
    } catch (err) {
        console.error('Registration error:', err.message);
        res.status(500).json({
            error: 'Registration Error',
            message: 'Failed to register user. Please try again later.'
        });
    }
});

/**
 * POST /api/auth/login - Login a user
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Username and password are required.'
            });
        }

        // Find user by username
        const userResult = await db.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Authentication Error',
                message: 'Invalid username or password.'
            });
        }

        const user = userResult.rows[0];

        // Compare password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({
                error: 'Authentication Error',
                message: 'Invalid username or password.'
            });
        }

        // Check if email is verified
        if (!user.email_verified) {
            return res.status(401).json({
                error: 'Verification Required',
                message: 'Please verify your email address before logging in.',
                needsVerification: true,
                email: user.email
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Calculate expiration date (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Store token in sessions table
        await db.query(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });

        // Return user info (excluding password)
        const { password_hash, ...userWithoutPassword } = user;

        res.json({
            message: 'Login successful',
            user: userWithoutPassword,
            token
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({
            error: 'Authentication Error',
            message: 'Failed to login. Please try again later.'
        });
    }
});

/**
 * POST /api/auth/logout - Logout a user
 */
router.post('/logout', authenticate, async (req, res) => {
    try {
        // Get token from Authorization header or cookies
        const token = req.cookies.token ||
                     (req.headers.authorization && req.headers.authorization.split(' ')[1]);

        if (token) {
            // Remove token from sessions table
            await db.query('DELETE FROM sessions WHERE token = $1', [token]);
        }

        // Clear cookie
        res.clearCookie('token');

        res.json({ message: 'Logout successful' });
    } catch (err) {
        console.error('Logout error:', err.message);
        res.status(500).json({
            error: 'Logout Error',
            message: 'Failed to logout. Please try again later.'
        });
    }
});

/**
 * POST /api/auth/forgot-password - Request a password reset
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Validate input
        if (!email) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Email is required.'
            });
        }

        // Find user by email
        const userResult = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        // Don't reveal if user exists or not for security reasons
        if (userResult.rows.length === 0) {
            return res.status(200).json({
                message: 'If an account with that email exists, we have sent password reset instructions.'
            });
        }

        const user = userResult.rows[0];

        // Generate a random token
        const token = crypto.randomBytes(32).toString('hex');

        // Calculate expiration (1 hour from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        // Delete any existing tokens for this user
        await db.query(
            'DELETE FROM password_reset_tokens WHERE user_id = $1',
            [user.id]
        );

        // Store token in database
        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );

        // Send password reset email
        try {
            await emailService.sendPasswordResetEmail(email, token, user.username);
            console.log(`Password reset email sent to ${email}`);
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            // Continue even if email fails
        }

        res.status(200).json({
            message: 'If an account with that email exists, we have sent password reset instructions.'
        });
    } catch (err) {
        console.error('Password reset request error:', err.message);
        res.status(500).json({
            error: 'Password Reset Error',
            message: 'Failed to process password reset request. Please try again later.'
        });
    }
});

/**
 * POST /api/auth/reset-password - Reset password with token
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        // Validate input
        if (!token || !password) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Token and password are required.'
            });
        }

        // Find token in database
        const tokenResult = await db.query(
            'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({
                error: 'Invalid Token',
                message: 'Password reset token is invalid or has expired.'
            });
        }

        const resetToken = tokenResult.rows[0];

        // Hash new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Update user's password
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, resetToken.user_id]
        );

        // Delete used token
        await db.query(
            'DELETE FROM password_reset_tokens WHERE id = $1',
            [resetToken.id]
        );

        res.status(200).json({
            message: 'Password has been reset successfully. You can now log in with your new password.'
        });
    } catch (err) {
        console.error('Password reset error:', err.message);
        res.status(500).json({
            error: 'Password Reset Error',
            message: 'Failed to reset password. Please try again later.'
        });
    }
});

/**
 * POST /api/auth/change-password - Change password (authenticated)
 */
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Current password and new password are required.'
            });
        }

        // Get user from database
        const userResult = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User Not Found',
                message: 'User not found.'
            });
        }

        const user = userResult.rows[0];

        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);

        if (!passwordMatch) {
            return res.status(400).json({
                error: 'Invalid Password',
                message: 'Current password is incorrect.'
            });
        }

        // Hash new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, userId]
        );

        res.status(200).json({
            message: 'Password changed successfully.'
        });
    } catch (err) {
        console.error('Change password error:', err.message);
        res.status(500).json({
            error: 'Change Password Error',
            message: 'Failed to change password. Please try again later.'
        });
    }
});

/**
 * GET /api/auth/verify-email/:token - Verify email address
 */
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Find token in database
        const tokenResult = await db.query(
            'SELECT * FROM email_verification_tokens WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({
                error: 'Invalid Token',
                message: 'Email verification token is invalid or has expired.'
            });
        }

        const verificationToken = tokenResult.rows[0];

        // Update user's email_verified status
        await db.query(
            'UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1',
            [verificationToken.user_id]
        );

        // Delete used token
        await db.query(
            'DELETE FROM email_verification_tokens WHERE id = $1',
            [verificationToken.id]
        );

        res.status(200).json({
            message: 'Email verified successfully. You can now log in.'
        });
    } catch (err) {
        console.error('Email verification error:', err.message);
        res.status(500).json({
            error: 'Verification Error',
            message: 'Failed to verify email. Please try again later.'
        });
    }
});

/**
 * POST /api/auth/resend-verification - Resend verification email
 */
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Email is required.'
            });
        }

        // Find user by email
        const userResult = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        // Don't reveal if user exists or not for security reasons
        if (userResult.rows.length === 0) {
            return res.status(200).json({
                message: 'If an account with that email exists, we have sent a verification email.'
            });
        }

        const user = userResult.rows[0];

        // Check if email is already verified
        if (user.email_verified) {
            return res.status(400).json({
                error: 'Already Verified',
                message: 'This email address is already verified.'
            });
        }

        // Delete any existing tokens for this user
        await db.query(
            'DELETE FROM email_verification_tokens WHERE user_id = $1',
            [user.id]
        );

        // Generate new verification token
        const token = crypto.randomBytes(32).toString('hex');

        // Calculate expiration (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Store token in database
        await db.query(
            'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );

        // Send verification email
        try {
            await emailService.sendWelcomeEmail(email, token, user.username);
            console.log(`Verification email resent to ${email}`);
        } catch (emailError) {
            console.error('Failed to resend verification email:', emailError);
            // Continue even if email fails
        }

        res.status(200).json({
            message: 'If an account with that email exists, we have sent a verification email.'
        });
    } catch (err) {
        console.error('Resend verification error:', err.message);
        res.status(500).json({
            error: 'Verification Error',
            message: 'Failed to resend verification email. Please try again later.'
        });
    }
});

module.exports = router;