// routes/uploads.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
const profilePicsDir = path.join(uploadsDir, 'profile-pics');

// Create directories if they don't exist
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(profilePicsDir)) {
    fs.mkdirSync(profilePicsDir);
}

/**
 * POST /api/uploads/profile-picture - Upload a profile picture
 * Requires authentication
 */
router.post('/profile-picture', authenticate, async (req, res) => {
    try {
        if (!req.files || !req.files.image) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'No image file uploaded.'
            });
        }

        const imageFile = req.files.image;
        
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(imageFile.mimetype)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid file type. Only JPEG, PNG, and GIF images are allowed.'
            });
        }
        
        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (imageFile.size > maxSize) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'File size exceeds the limit of 5MB.'
            });
        }
        
        // Generate a unique filename
        const timestamp = Date.now();
        const userId = req.user.id;
        const fileExtension = path.extname(imageFile.name);
        const filename = `user_${userId}_${timestamp}${fileExtension}`;
        const filepath = path.join(profilePicsDir, filename);
        
        // Save the file
        await imageFile.mv(filepath);
        
        // Update user's profile_picture in the database
        const publicPath = `/uploads/profile-pics/${filename}`;
        await db.query(
            'UPDATE users SET profile_picture = $1, updated_at = NOW() WHERE id = $2',
            [publicPath, userId]
        );
        
        res.status(200).json({
            message: 'Profile picture uploaded successfully.',
            profilePicture: publicPath
        });
    } catch (err) {
        console.error('Profile picture upload error:', err.message);
        res.status(500).json({
            error: 'Upload Error',
            message: 'Failed to upload profile picture. Please try again later.'
        });
    }
});

/**
 * DELETE /api/uploads/profile-picture - Remove profile picture
 * Requires authentication
 */
router.delete('/profile-picture', authenticate, async (req, res) => {
    try {
        // Get user's current profile picture
        const userResult = await db.query(
            'SELECT profile_picture FROM users WHERE id = $1',
            [req.user.id]
        );
        
        const user = userResult.rows[0];
        
        if (!user.profile_picture) {
            return res.status(400).json({
                error: 'Not Found',
                message: 'User does not have a profile picture.'
            });
        }
        
        // Extract filename from path
        const filename = path.basename(user.profile_picture);
        const filepath = path.join(profilePicsDir, filename);
        
        // Delete file if it exists
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        
        // Update user record
        await db.query(
            'UPDATE users SET profile_picture = NULL, updated_at = NOW() WHERE id = $1',
            [req.user.id]
        );
        
        res.status(200).json({
            message: 'Profile picture removed successfully.'
        });
    } catch (err) {
        console.error('Profile picture removal error:', err.message);
        res.status(500).json({
            error: 'Removal Error',
            message: 'Failed to remove profile picture. Please try again later.'
        });
    }
});

module.exports = router;
