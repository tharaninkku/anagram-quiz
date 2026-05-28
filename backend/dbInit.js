import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function setupDatabase() {
  const dbPassword = process.env.DB_PASSWORD;
  
  if (!dbPassword || dbPassword === 'YOUR_POSTGRES_PASSWORD_HERE') {
    console.error('Error: Please set your actual PostgreSQL database password in the .env file first!');
    process.exit(1);
  }

  // Step 1: Connect to default 'postgres' database to check/create the project database
  const adminClient = new Client({
    user: process.env.DB_USER,
    password: dbPassword,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    console.log('Connected to default postgres database.');

    // Check if target database exists
    const res = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_DATABASE]
    );

    if (res.rowCount === 0) {
      console.log(`Database "${process.env.DB_DATABASE}" does not exist. Creating it...`);
      await adminClient.query(`CREATE DATABASE "${process.env.DB_DATABASE}"`);
      console.log(`Database "${process.env.DB_DATABASE}" created successfully.`);
    } else {
      console.log(`Database "${process.env.DB_DATABASE}" already exists.`);
    }
  } catch (err) {
    console.error('Error checking/creating database:', err);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // Step 2: Connect to the project database to create the tables
  const dbClient = new Client({
    user: process.env.DB_USER,
    password: dbPassword,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
  });

  try {
    await dbClient.connect();
    console.log(`Connected to database "${process.env.DB_DATABASE}". Creating tables...`);

    // 1. Dictionary Table & Indexes
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS dictionary (
        id SERIAL PRIMARY KEY,
        word VARCHAR(50) NOT NULL UNIQUE,
        signature VARCHAR(50) NOT NULL,
        length INTEGER NOT NULL,
        is_pangram BOOLEAN DEFAULT FALSE
      );
      
      CREATE INDEX IF NOT EXISTS idx_dictionary_signature ON dictionary(signature);
      CREATE INDEX IF NOT EXISTS idx_dictionary_length ON dictionary(length);
    `);
    console.log('- Table "dictionary" and indexes verified.');

    // 2. Users Table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        total_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('- Table "users" verified.');

    // 3. Challenges Table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        base_word VARCHAR(50) NOT NULL,
        date DATE UNIQUE
      );
    `);
    console.log('- Table "challenges" verified.');

    // 4. User Scores Table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS user_scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        time_taken_seconds INTEGER NOT NULL,
        word_length INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure word_length column exists if the table was created before this update
    await dbClient.query(`
      ALTER TABLE user_scores 
      ADD COLUMN IF NOT EXISTS word_length INTEGER NOT NULL DEFAULT 5;
    `);
    console.log('- Table "user_scores" verified.');

    console.log('\nAll database tables set up successfully!');
  } catch (err) {
    console.error('Error setting up tables:', err);
  } finally {
    await dbClient.end();
  }
}

setupDatabase();
