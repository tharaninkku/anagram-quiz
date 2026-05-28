import pg from 'pg';

const connectionString = "postgresql://neondb_owner:npg_mU1sYzfuLx2w@ep-little-waterfall-aou01yxx.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const dbClient = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await dbClient.connect();
    console.log("Connected to Neon Database!");

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
    
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        total_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        base_word VARCHAR(50) NOT NULL,
        date DATE UNIQUE
      );
    `);

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

    console.log("Tables created successfully on Neon!");
  } catch(e) {
    console.error(e);
  } finally {
    await dbClient.end();
  }
}

run();
