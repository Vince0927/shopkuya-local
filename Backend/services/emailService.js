// services/emailService.js
const nodemailer = require('nodemailer');

// Create a transporter object using SMTP transport
// For development, we'll use a test account from Ethereal
// In production, you would use a real email service like SendGrid, Mailgun, etc.
let transporter;

// Initialize the transporter
const initTransporter = async () => {
    // If we're in development mode, create a test account
    if (process.env.NODE_ENV !== 'production' && !process.env.EMAIL_HOST) {
        // Generate test SMTP service account from ethereal.email
        const testAccount = await nodemailer.createTestAccount();
        
        // Create a SMTP transporter object
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user, // generated ethereal user
                pass: testAccount.pass, // generated ethereal password
            },
        });
        
        console.log('Using Ethereal test account for email:', testAccount.user);
    } else {
        // Create a real SMTP transporter object using environment variables
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
        
        console.log('Using real email service for sending emails');
    }
};

// Initialize the transporter when the service is first required
initTransporter().catch(console.error);

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text email body
 * @param {string} options.html - HTML email body
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendEmail = async ({ to, subject, text, html }) => {
    try {
        // Make sure transporter is initialized
        if (!transporter) {
            await initTransporter();
        }
        
        // Send mail with defined transport object
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"ShopKuya" <noreply@shopkuya.com>',
            to,
            subject,
            text,
            html,
        });
        
        console.log('Message sent: %s', info.messageId);
        
        // Preview only available when sending through an Ethereal account
        if (process.env.NODE_ENV !== 'production' && !process.env.EMAIL_HOST) {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }
        
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

/**
 * Send a password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Password reset token
 * @param {string} username - Recipient username
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendPasswordResetEmail = async (email, token, username) => {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    
    const subject = 'Reset Your ShopKuya Password';
    
    const text = `
        Hello ${username},
        
        You requested a password reset for your ShopKuya account.
        
        Please click the link below to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you did not request a password reset, please ignore this email.
        
        Best regards,
        The ShopKuya Team
    `;
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your ShopKuya Password</h2>
            <p>Hello ${username},</p>
            <p>You requested a password reset for your ShopKuya account.</p>
            <p>Please click the button below to reset your password:</p>
            <p style="text-align: center;">
                <a href="${resetUrl}" style="display: inline-block; background-color: #4a90e2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
            </p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
            <p>Best regards,<br>The ShopKuya Team</p>
        </div>
    `;
    
    return sendEmail({ to: email, subject, text, html });
};

/**
 * Send a welcome email with verification link
 * @param {string} email - Recipient email
 * @param {string} token - Email verification token
 * @param {string} username - Recipient username
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendWelcomeEmail = async (email, token, username) => {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${token}`;
    
    const subject = 'Welcome to ShopKuya - Verify Your Email';
    
    const text = `
        Hello ${username},
        
        Welcome to ShopKuya! We're excited to have you on board.
        
        Please click the link below to verify your email address:
        ${verifyUrl}
        
        This link will expire in 24 hours.
        
        Best regards,
        The ShopKuya Team
    `;
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to ShopKuya!</h2>
            <p>Hello ${username},</p>
            <p>We're excited to have you on board. To get started, please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
                <a href="${verifyUrl}" style="display: inline-block; background-color: #4a90e2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
            </p>
            <p>This link will expire in 24 hours.</p>
            <p>Best regards,<br>The ShopKuya Team</p>
        </div>
    `;
    
    return sendEmail({ to: email, subject, text, html });
};

module.exports = {
    sendEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail
};
