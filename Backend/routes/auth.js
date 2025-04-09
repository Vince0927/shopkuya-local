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
    console.log('Register endpoint called with body:', {
        ...req.body,
        password: req.body.password ? '***HIDDEN***' : undefined
    });
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
        let passwordHash;
        try {
            passwordHash = await bcrypt.hash(password, saltRounds);
            console.log('Password hashed successfully');
        } catch (hashError) {
            console.error('Error hashing password:', hashError);
            return res.status(500).json({
                error: 'Registration Error',
                message: 'Error processing your registration. Please try again.'
            });
        }

        // Check the users table schema to determine the correct password column name
        let passwordColumnName = 'password_hash'; // Default column name from schema
        try {
            // Try to get the column names from the users table
            const tableInfoResult = await db.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
            );

            const columnNames = tableInfoResult.rows.map(row => row.column_name);
            console.log('Available columns in users table:', columnNames);

            // Check if password_hash exists, otherwise look for alternatives
            if (!columnNames.includes('password_hash')) {
                if (columnNames.includes('password')) {
                    passwordColumnName = 'password';
                    console.log('Using "password" column instead of "password_hash"');
                } else {
                    console.error('No suitable password column found in users table');
                    return res.status(500).json({
                        error: 'Registration Error',
                        message: 'Database schema issue. Please contact support.'
                    });
                }
            }
        } catch (schemaError) {
            console.error('Error checking database schema:', schemaError);
            // Continue with default column name and hope for the best
        }

        // Insert new user
        let result;
        try {
            // Dynamically build the query based on the password column name
            const query = `INSERT INTO users (username, email, ${passwordColumnName}, role)
                          VALUES ($1, $2, $3, $4) RETURNING id, username, email, role`;

            result = await db.query(query, [username, email, passwordHash, role]);
            console.log('User inserted successfully');
        } catch (dbError) {
            console.error('Error inserting user into database:', dbError);
            // Check for unique violation
            if (dbError.code === '23505') {
                return res.status(409).json({
                    error: 'Registration Error',
                    message: 'Username or email already exists.'
                });
            }
            return res.status(500).json({
                error: 'Registration Error',
                message: 'Error creating user account. Please try again.',
                details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
        }

        const newUser = result.rows[0];

        // Generate verification token
        let token;
        try {
            token = crypto.randomBytes(32).toString('hex');
            console.log('Verification token generated successfully');
        } catch (tokenError) {
            console.error('Error generating verification token:', tokenError);
            token = Date.now().toString(36) + Math.random().toString(36).substring(2); // Fallback token
            console.log('Using fallback verification token');
        }

        // Calculate expiration (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Store token in database
        try {
            await db.query(
                'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
                [newUser.id, token, expiresAt]
            );
            console.log('Verification token stored in database');
        } catch (tokenDbError) {
            console.error('Error storing verification token:', tokenDbError);
            // Continue with registration even if token storage fails
        }

        // Send verification email
        try {
            await emailService.sendWelcomeEmail(email, token, username);
            console.log(`Verification email sent to ${email}`);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Continue with registration even if email fails
            // Log more details about the error
            console.error('Email error details:', {
                error: emailError.message,
                stack: emailError.stack,
                code: emailError.code
            });
        }

        res.status(201).json({
            message: 'User registered successfully. Please check your email to verify your account.',
            user: newUser
        });
    } catch (err) {
        console.error('Registration error:', err.message);
        console.error('Error stack:', err.stack);
        console.error('Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));

        // Check for specific error types
        if (err.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({
                error: 'Registration Error',
                message: 'Username or email already exists.'
            });
        }

        res.status(500).json({
            error: 'Registration Error',
            message: 'Failed to register user. Please try again later.',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

/**
 * POST /api/auth/login - Login a user
 */
router.post('/login', async (req, res) => {
    console.log('Login endpoint called with username:', req.body.username);
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            console.log('Login validation error: Username or password missing');
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Username and password are required.'
            });
        }

        // Find user by username
        console.log('Querying database for user:', username);
        const userResult = await db.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            console.log('User not found:', username);
            return res.status(401).json({
                error: 'Authentication Error',
                message: 'Invalid username or password.'
            });
        }

        const user = userResult.rows[0];
        console.log('User found:', user.username, 'Email verified:', user.email_verified);

        // Determine which password field to use
        let hashedPassword = user.password_hash;

        // If password_hash doesn't exist, try password field
        if (hashedPassword === undefined) {
            if (user.password !== undefined) {
                hashedPassword = user.password;
                console.log('Using "password" field instead of "password_hash"');
            } else {
                console.error('No password field found in user record');
                return res.status(500).json({
                    error: 'Authentication Error',
                    message: 'Database schema issue. Please contact support.'
                });
            }
        }

        // Compare password
        console.log('Comparing passwords...');
        const passwordMatch = await bcrypt.compare(password, hashedPassword);

        if (!passwordMatch) {
            console.log('Password does not match for user:', username);
            return res.status(401).json({
                error: 'Authentication Error',
                message: 'Invalid username or password.'
            });
        }
        console.log('Password match successful');

        // Temporarily bypass email verification check for testing
        // if (!user.email_verified) {
        //     return res.status(401).json({
        //         error: 'Verification Required',
        //         message: 'Please verify your email address before logging in.',
        //         needsVerification: true,
        //         email: user.email
        //     });
        // }

        // Generate JWT token
        console.log('Generating JWT token...');
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        console.log('JWT token generated successfully');

        // Calculate expiration date (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Store token in sessions table
        console.log('Storing token in sessions table...');
        await db.query(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );
        console.log('Token stored in sessions table');

        // Set cookie
        console.log('Setting cookie...');
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            sameSite: 'lax' // Add this to ensure cookies work across domains
        });
        console.log('Cookie set successfully');

        // Return user info (excluding password)
        const { password_hash, ...userWithoutPassword } = user;

        console.log('Login successful for user:', username);
        res.json({
            message: 'Login successful',
            user: userWithoutPassword,
            token
        });
    } catch (err) {
        console.error('Login error:', err.message);
        console.error('Error stack:', err.stack);
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

/**
 * GET /api/auth/test-db - Test database connection
 */
router.get('/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW() as current_time');
        res.json({
            message: 'Database connection successful',
            time: result.rows[0].current_time
        });
    } catch (err) {
        console.error('Database test error:', err);
        res.status(500).json({
            error: 'Database Error',
            message: 'Failed to connect to database',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

/**
 * GET /api/auth/check-schema - Check database schema
 */
router.get('/check-schema', async (req, res) => {
    try {
        // Check users table
        const usersTableResult = await db.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'"
        );

        // Check if users table exists
        if (usersTableResult.rows.length === 0) {
            return res.status(500).json({
                error: 'Schema Error',
                message: 'Users table not found. Database may not be properly initialized.'
            });
        }

        // Check for required tables
        const tablesResult = await db.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        );

        const tables = tablesResult.rows.map(row => row.table_name);

        // Check for email verification tokens table
        const hasEmailVerificationTable = tables.includes('email_verification_tokens');

        res.json({
            message: 'Database schema check completed',
            users_table: {
                columns: usersTableResult.rows,
                has_password_hash: usersTableResult.rows.some(col => col.column_name === 'password_hash'),
                has_password: usersTableResult.rows.some(col => col.column_name === 'password')
            },
            tables: tables,
            has_email_verification_table: hasEmailVerificationTable
        });
    } catch (err) {
        console.error('Schema check error:', err);
        res.status(500).json({
            error: 'Schema Error',
            message: 'Failed to check database schema',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;