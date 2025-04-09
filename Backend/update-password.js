// update-password.js
const db = require('./db');

async function updatePassword() {
    try {
        const newHash = '$2b$10$.Cc7dLSrkus5nAHgfDIucunmI91meTfosBC.uJCT7LJOp.pJVqoPK';

        const result = await db.query(
            'UPDATE users SET password_hash = $1',
            [newHash]
        );

        console.log('Password hash updated successfully');
        console.log(`${result.rowCount} rows affected`);

        process.exit(0);
    } catch (error) {
        console.error('Error updating password hash:', error);
        process.exit(1);
    }
}

updatePassword();
