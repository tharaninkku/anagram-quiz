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

async function check() {
  try {
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='user_scores'");
    console.log("COLUMNS IN user_scores:");
    console.log(cols.rows);

    const scores = await pool.query("SELECT * FROM user_scores");
    console.log("SCORES IN DATABASE:");
    console.log(scores.rows);

    const leaderboard = await pool.query(`
      SELECT u.username, us.score, us.created_at, us.word_length
      FROM user_scores us
      JOIN users u ON us.user_id = u.id
      ORDER BY us.score DESC
    `);
    console.log("LEADERBOARD ROWS:");
    console.log(leaderboard.rows);
  } catch (err) {
    console.error("DATABASE ERROR:", err);
  } finally {
    await pool.end();
  }
}
check();
