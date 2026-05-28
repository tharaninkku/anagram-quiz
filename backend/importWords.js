import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
});

// ==========================================
// CHALLENGE: Implement this function!
// It should take a string (word), make sure it is uppercase, 
// sort its letters alphabetically, and return it.
// Example: "apple" -> "AELPP"
// Hint: You can turn a string into an array of letters using .split(''), 
// sort it using .sort(), and join it back into a string using .join('')
// ==========================================
function calculateSignature(word) {
  // TODO: Write your code here
  const sorted_alphabet = word.toUpperCase().split('').sort().join('')
  return sorted_alphabet; 
}

async function importWords() {
  const WORD_LIST_URL = 'https://gist.githubusercontent.com/scrabblewords/6b7d99f608cd428efe2a21228c62a788/raw/CSW21.txt';

  console.log('Fetching word list from GitHub...');
  try {
    const response = await fetch(WORD_LIST_URL);
    if (!response.ok) throw new Error(`Failed to fetch word list: ${response.statusText}`);
    
    const text = await response.text();
    const allWords = text.split('\n');
    console.log(`Found ${allWords.length} words in raw list.`);

    // Filter words:
    // - Trim whitespace
    // - Convert to uppercase
    // - Only keep words that are between 3 and 8 letters long
    // - Ensure they contain only English alphabets
    const filteredWords = allWords
      .map(w => w.trim().toUpperCase())
      .filter(w => w.length >= 3 && w.length <= 8 && /^[A-Z]+$/.test(w));

    console.log(`Filtered to ${filteredWords.length} words (lengths 3 to 8).`);

    // Prepare data for insertion
    const preparedWords = filteredWords.map(word => {
      const signature = calculateSignature(word);
      return [word, signature, word.length];
    });

    console.log('Clearing old dictionary entries from database...');
    await pool.query('TRUNCATE TABLE dictionary CASCADE;');

    console.log('Importing words in batches to database (this might take 10-15 seconds)...');
    
    const batchSize = 1000;
    for (let i = 0; i < preparedWords.length; i += batchSize) {
      const batch = preparedWords.slice(i, i + batchSize);
      
      // Build a bulk INSERT query:
      // INSERT INTO dictionary (word, signature, length) VALUES ($1, $2, $3), ($4, $5, $6)...
      const valuesPlaceholders = [];
      const queryValues = [];
      
      batch.forEach((row, rowIndex) => {
        const offset = rowIndex * 3;
        valuesPlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        queryValues.push(row[0], row[1], row[2]);
      });

      const queryText = `
        INSERT INTO dictionary (word, signature, length) 
        VALUES ${valuesPlaceholders.join(', ')}
        ON CONFLICT (word) DO NOTHING;
      `;

      await pool.query(queryText, queryValues);
    }

    console.log('Import completed successfully!');

  } catch (error) {
    console.error('Error importing words:', error);
  } finally {
    await pool.end();
  }
}

importWords();
