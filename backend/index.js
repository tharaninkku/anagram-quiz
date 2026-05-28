import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// CORS allows our React frontend (running on another port) to talk to this backend
app.use(cors());
// express.json() lets Express read JSON data sent in request bodies
app.use(express.json());

// Database connection pool
const { Pool } = pg;

// Use DATABASE_URL if available (for production like Render + Neon)
// Otherwise fallback to local variables from .env
const pool = new Pool(
  process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } 
      }
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_DATABASE,
      }
);

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully at:', res.rows[0].now);
  }
});

// Default Root Route
app.get('/', (req, res) => {
  res.send('Welcome to the Anagram Quiz API!');
});

// Helper function to scramble a word's letters
function scrambleWord(word) {
  // split('') turns word into array of letters,
  // sort() shuffles them randomly,
  // join('') joins them back to a string
  return word.split('').sort(() => Math.random() - 0.5).join('');
}

// Endpoint to fetch a new anagram challenge
app.get('/api/challenge', async (req, res) => {
  const length = parseInt(req.query.length) || 5;

  if (length < 3 || length > 8) {
    return res.status(400).json({ error: 'Length must be between 3 and 8' });
  }

  try {
    // CHALLENGE 1: Write an SQL query to select ONE random word and its signature 
    // from the 'dictionary' table where the word length matches our parameter.
    // Hint: Use '$1' for the query parameter, 'ORDER BY RANDOM()' to randomize, and 'LIMIT 1'.
    const randomWordQuery = `
      SELECT word, signature FROM dictionary WHERE length = $1 ORDER BY RANDOM() LIMIT 1
    `;
    const randomWordResult = await pool.query(randomWordQuery, [length]);

    if (randomWordResult.rows.length === 0) {
      return res.status(404).json({ error: 'No words found of that length' });
    }

    const targetWord = randomWordResult.rows[0].word;
    const signature = randomWordResult.rows[0].signature;

    // CHALLENGE 2: Write an SQL query to select ALL words from the 'dictionary' table
    // that share the same signature (this finds all valid anagrams!).
    // Hint: Select the 'word' column, and filter where the signature equals our parameter '$1'.
    const anagramsQuery = `
      SELECT word FROM dictionary WHERE signature = $1 
    `;
    const anagramsResult = await pool.query(anagramsQuery, [signature]);

    // Map the query result to get a simple array of strings: ['WORD1', 'WORD2', ...]
    const answers = anagramsResult.rows.map(row => row.word);

    // Scramble the target word letters
    const scrambled = scrambleWord(targetWord);

    res.json({
      letters: scrambled.split(''), // Send scrambled letters as array: ['A', 'P', 'E', 'L', 'P']
      answers: answers,
      length: length
    });

  } catch (error) {
    console.error('Error generating challenge:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint to save a user's score in the database
app.post('/api/scores', async (req, res) => {
  const { username, score, timeTaken, wordLength } = req.body;

  if (!username || score === undefined) {
    return res.status(400).json({ error: 'Username and score are required' });
  }

  try {
    // Start a transaction. A transaction ensures that if one insert fails, 
    // none of the database changes are saved (keeping our data clean!).
    await pool.query('BEGIN');

    // ==========================================
    // CHALLENGE 3: Insert the username into the 'users' table.
    // If the username already exists (conflict), we shouldn't fail—we just update it
    // with a dummy update and return the 'id' of that user.
    //
    // Hint: In PostgreSQL, you can use:
    // INSERT INTO users (username) VALUES ($1)
    // ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
    // RETURNING id;
    // ==========================================
    const userQuery = `
      INSERT INTO users (username) VALUES ($1)
      ON CONFLICT (username) DO UPDATE SET  username = EXCLUDED.username
      RETURNING id;
    `;
    const userResult = await pool.query(userQuery, [username.trim()]);
    const userId = userResult.rows[0].id;

    // ==========================================
    // CHALLENGE 4: Insert the score into the 'user_scores' table.
    // Columns to insert: user_id, score, time_taken_seconds.
    // Use $1, $2, $3 as placeholders for variables.
    //
    // Hint:
    // INSERT INTO user_scores (user_id, score, time_taken_seconds) VALUES ($1, $2, $3)
    // ==========================================
    const scoreQuery = `
      INSERT INTO user_scores (user_id, score, time_taken_seconds, word_length) VALUES ($1, $2, $3, $4);
    `;
    await pool.query(scoreQuery, [userId, score, timeTaken || 0, wordLength || 5]);

    // Update the user's overall accumulated score
    await pool.query(
      'UPDATE users SET total_score = total_score + $1 WHERE id = $2',
      [score, userId]
    );

    // Commit transaction
    await pool.query('COMMIT');
    res.json({ success: true, message: 'Score saved successfully!' });

  } catch (error) {
    // If anything fails, undo all changes in this transaction block
    await pool.query('ROLLBACK');
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// Endpoint to fetch the leaderboard top scores
app.get('/api/leaderboard', async (req, res) => {
  const length = parseInt(req.query.length) || 5;
  try {
    // ==========================================
    // CHALLENGE 5: Write the SQL query to get the top 10 scores with their usernames!
    // Select:
    //   - 'username' from the 'users' table (alias u)
    //   - 'score' and 'created_at' from the 'user_scores' table (alias us)
    // Join the two tables together where 'us.user_id = u.id'.
    // Filter by word_length.
    // Order the results by score in descending order (highest first) and limit to 10 rows.
    //
    // Hint:
    // SELECT u.username, us.score, us.created_at
    // FROM user_scores us
    // JOIN users u ON us.user_id = u.id
    // WHERE us.word_length = $1
    // ORDER BY us.score DESC
    // LIMIT 10;
    // ==========================================
    const leaderboardQuery = `
      SELECT u.username, us.score, us.created_at
      FROM user_scores us
      JOIN users u ON us.user_id = u.id
      WHERE us.word_length = $1
      ORDER BY us.score DESC
      LIMIT 10;
    `;
    const result = await pool.query(leaderboardQuery, [length]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Start Server listening on the specified PORT
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
