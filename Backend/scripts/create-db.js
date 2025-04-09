// scripts/create-db.js
const { Client } = require('pg');

async function createDatabase() {
    // Connect to the default 'postgres' database to create a new database
    const client = new Client({
        user: 'postgres',
        password: 'Postgresql143!',
        host: 'localhost',
        port: 5432,
        database: 'postgres'
    });

    try {
        await client.connect();
        console.log('Connected to PostgreSQL');

        // Check if shopkuya database already exists
        const checkResult = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = 'shopkuya'"
        );

        if (checkResult.rows.length === 0) {
            // Create the shopkuya database
            await client.query('CREATE DATABASE shopkuya');
            console.log('Database "shopkuya" created successfully');
        } else {
            console.log('Database "shopkuya" already exists');
        }
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await client.end();
    }
}

createDatabase();
