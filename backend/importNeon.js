import pg from 'pg';

const connectionString = "postgresql://neondb_owner:npg_mU1sYzfuLx2w@ep-little-waterfall-aou01yxx.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const dbClient = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

function calculateSignature(word) {
  return word.toUpperCase().split('').sort().join('');
}

async function run() {
  const WORD_LIST_URL = 'https://gist.githubusercontent.com/scrabblewords/6b7d99f608cd428efe2a21228c62a788/raw/CSW21.txt';

  try {
    await dbClient.connect();
    console.log("Connected to Neon for importing words...");

    console.log('Fetching word list from GitHub...');
    const response = await fetch(WORD_LIST_URL);
    if (!response.ok) throw new Error(`Failed to fetch word list: ${response.statusText}`);
    
    const text = await response.text();
    const allWords = text.split('\n');

    const filteredWords = allWords
      .map(w => w.trim().toUpperCase())
      .filter(w => w.length >= 3 && w.length <= 8 && /^[A-Z]+$/.test(w));

    console.log(`Found ${filteredWords.length} valid words. Beginning insertion...`);
    
    // Process in batches
    const batchSize = 1000;
    for (let i = 0; i < filteredWords.length; i += batchSize) {
      const batch = filteredWords.slice(i, i + batchSize);
      
      const values = [];
      const queryParams = [];
      let paramIndex = 1;

      batch.forEach(word => {
        const signature = calculateSignature(word);
        const length = word.length;
        values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        queryParams.push(word, signature, length);
      });

      const query = `
        INSERT INTO dictionary (word, signature, length)
        VALUES ${values.join(', ')}
        ON CONFLICT (word) DO NOTHING
      `;

      await dbClient.query(query, queryParams);
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(filteredWords.length / batchSize)}`);
    }

    console.log("All words successfully imported to Neon!");
  } catch(e) {
    console.error(e);
  } finally {
    await dbClient.end();
  }
}

run();
