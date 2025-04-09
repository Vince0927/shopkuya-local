// create_db.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection to postgres database to create our app database
const adminClient = new Client({
  user: 'postgres',
  password: 'Postgresql143!',
  host: 'localhost',
  port: 5432,
  database: 'postgres' // Connect to default postgres database
});

async function setupDatabase() {
  try {
    // Connect to postgres database
    await adminClient.connect();
    console.log('Connected to postgres database');

    // Drop the database if it exists
    try {
      await adminClient.query('DROP DATABASE IF EXISTS ecommerce_mvp');
      console.log('Dropped existing ecommerce_mvp database');
    } catch (err) {
      console.log('Database does not exist or could not be dropped:', err.message);
    }

    // Create the database
    await adminClient.query('CREATE DATABASE ecommerce_mvp');
    console.log('Created ecommerce_mvp database');

    // Close the admin connection
    await adminClient.end();
    console.log('Disconnected from postgres database');

    // Now connect to the new database to run the schema
    const appClient = new Client({
      user: 'postgres',
      password: 'Postgresql143!',
      host: 'localhost',
      port: 5432,
      database: 'ecommerce_mvp' // Connect to our new database
    });

    await appClient.connect();
    console.log('Connected to ecommerce_mvp database');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'database.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute the schema
    await appClient.query(schema);
    console.log('Schema executed successfully');

    // Close the connection
    await appClient.end();
    console.log('Database setup complete!');

  } catch (err) {
    console.error('Error setting up database:', err);
  }
}

setupDatabase();
