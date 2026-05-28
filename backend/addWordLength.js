import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
});

async function migrate() {
  try {
    console.log("Adding word_length column to user_scores...");
    await pool.query(`
      ALTER TABLE user_scores 
      ADD COLUMN IF NOT EXISTS word_length INTEGER NOT NULL DEFAULT 5;
    `);
    console.log("Successfully added word_length column.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
