import { useState, useEffect } from 'react'
import './App.css'

function App() {
  // Game state
  const [username, setUsername] = useState('');
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [letters, setLetters] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [foundWords, setFoundWords] = useState([]);
  const [totalScore, setTotalScore] = useState(0); // Cumulative score accumulator
  const [inputValue, setInputValue] = useState('');
  const [wordLength, setWordLength] = useState(5);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Timer & Game Over states
  const [timeLeft, setTimeLeft] = useState(60); // 60-second timer
  const [isGameOver, setIsGameOver] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // Use Environment Variable for backend URL (fallback to localhost for local dev)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Fetch challenge from our Express Backend
  const fetchNewChallenge = async (len) => {
    try {
      const response = await fetch(`${API_URL}/api/challenge?length=${len}`);
      if (!response.ok) throw new Error('Failed to fetch challenge');
      
      const data = await response.json();
      setLetters(data.letters);
      setAnswers(data.answers);
      setFoundWords([]);
      setInputValue('');
      setMessage({ text: 'Find as many anagrams as you can!', type: '' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error connecting to backend API', type: 'error' });
    }
  };

  // Fetch a challenge when wordLength changes
  useEffect(() => {
    if (isGameStarted) {
      fetchNewChallenge(wordLength);
    }
  }, [wordLength, isGameStarted]);

  // Timer Countdown Effect
  useEffect(() => {
    // Only run the timer if the game is started and not over
    if (!isGameStarted || isGameOver) return;

    // Stop game when timer hits 0
    if (timeLeft === 0) {
      handleGameOver();
      return;
    }

    // Tick down every 1 second (1000ms)
    const timerId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    // Cleanup the timer when this component re-renders or stops
    return () => clearInterval(timerId);
  }, [timeLeft, isGameStarted, isGameOver]);

  // Handle Game Over
  const handleGameOver = () => {
    setIsGameOver(true);
    setMessage({ text: '⏳ Time is up! Game Over!', type: 'error' });
    submitScore();
  };

  // ===================================================
  // CHALLENGE: Write the HTTP POST request to save the score!
  // ===================================================
  const submitScore = async () => {
    try {
      console.log('Saving score to database...');
      const response = await fetch(`${API_URL}/api/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          score: totalScore, // Send the cumulative score!
          timeTaken: 60 - timeLeft,
          wordLength: wordLength // Send the word length!
        })
      });

      if (response.ok) {
        console.log('Score saved successfully!');
        // Fetch the high scores to display on the leaderboard
        fetchLeaderboard();
      } else {
        console.error('Failed to save score');
      }
    } catch (err) {
      console.error("Error saving score:", err);
    }
  };

  // Fetch the Leaderboard from our Express Backend (filtered by word length)
  const fetchLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const response = await fetch(`${API_URL}/api/leaderboard?length=${wordLength}`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // Start the game after user enters their name
  const handleStartGame = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setTotalScore(0); // Reset cumulative score to 0 on new game
      setTimeLeft(60); // Set timer to 60 seconds
      setIsGameOver(false); // Reset game over status
      setIsGameStarted(true);
    }
  };

  // Play again function (starts a new 60-second session for same user)
  const handlePlayAgain = () => {
    setTotalScore(0);
    setTimeLeft(60);
    setIsGameOver(false);
    fetchNewChallenge(wordLength);
  };

  // Handle Guess Submission (Your work from yesterday!)
  const handleGuessSubmit = (e) => {
    e.preventDefault();
    const guess = inputValue.trim().toUpperCase();

    if (!guess || isGameOver) return;

    if (answers.includes(guess) && !foundWords.includes(guess)) {
      setFoundWords([...foundWords, guess]);
      setTotalScore((prev) => prev + 1); // Add +1 to cumulative score
      setMessage({ text: 'Correct!', type: 'success' });
      setInputValue('');
    } else if (answers.includes(guess)) {
      setMessage({ text: 'You already found that word!', type: 'error' });
      setInputValue('');
    } else {
      setMessage({ text: 'Not a valid word!', type: 'error' });
      setInputValue('');
    }
  };

  // Logout to change username
  const handleLogout = () => {
    setUsername('');
    setIsGameStarted(false);
    setIsGameOver(false);
    setTotalScore(0);
    setFoundWords([]);
    setInputValue('');
    setMessage({ text: '', type: '' });
  };

  // --- SCREEN 1: Username Setup Screen ---
  if (!isGameStarted) {
    return (
      <div className="game-container">
        <h1>Anagram Quiz</h1>
        <p className="subtitle">Select your difficulty and enter your name to start!</p>
        
        <div className="length-selector" style={{ marginTop: '20px', marginBottom: '20px' }}>
          <label>Word Length:</label>
          {[3, 4, 5, 6, 7, 8].map((len) => (
            <button
              key={len}
              type="button"
              className={`selector-btn ${wordLength === len ? 'active' : ''}`}
              onClick={() => setWordLength(len)}
            >
              {len}
            </button>
          ))}
        </div>

        <form onSubmit={handleStartGame} className="guess-form" style={{ marginTop: '20px' }}>
          <input
            type="text"
            className="guess-input"
            placeholder="Your Username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary">
            Start Game
          </button>
        </form>
      </div>
    );
  }

  // --- SCREEN 2: Active Gameplay or Game Over Screen ---
  return (
    <div className="game-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Player: <strong>{username}</strong></span>
        {/* Timer UI */}
        <span style={{ 
          fontSize: '1.2rem', 
          fontWeight: '700', 
          color: timeLeft <= 10 ? 'var(--error)' : 'var(--accent)',
          fontFamily: 'var(--font-mono)' 
        }}>
          ⏳ {timeLeft}s
        </span>
      </div>

      <h1>Anagram Quiz</h1>

      {/* Letter Bubbles */}
      <div className="letter-area">
        {letters.map((letter, index) => (
          <div key={index} className="letter-bubble">
            {letter}
          </div>
        ))}
      </div>

      {/* Guess Input Form (Disabled when Game Over) */}
      <form onSubmit={handleGuessSubmit} className="guess-form">
        <input
          type="text"
          disabled={isGameOver}
          className="guess-input"
          placeholder={isGameOver ? "Game Over" : "Type your word..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="submit" disabled={isGameOver} className="btn-primary">
          Submit
        </button>
      </form>

      {/* Message Feedbacks */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Score and Stats */}
      <div className="game-stats">
        <div className="stat-box">
          <h3>Round Words</h3>
          <p>{foundWords.length} / {answers.length}</p>
        </div>
        <div className="stat-box">
          <h3>Total Score</h3>
          <p>{totalScore} pts</p>
        </div>
        <div className="stat-box">
          <h3>Goal</h3>
          <p>{wordLength} Letters</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
        {isGameOver ? (
          <>
            <button className="btn-secondary" onClick={handlePlayAgain}>
              Play Again
            </button>
            <button className="btn-secondary" style={{ borderColor: 'var(--error)', color: 'var(--error)' }} onClick={handleLogout}>
              Change Player
            </button>
          </>
        ) : (
          <button className="btn-secondary" onClick={() => fetchNewChallenge(wordLength)}>
            Skip / Next
          </button>
        )}
        {!isGameOver && (
          <button className="btn-secondary" style={{ borderColor: 'var(--error)', color: 'var(--error)' }} onClick={handleGameOver}>
            End Game
          </button>
        )}
      </div>

      {/* Leaderboard & Correct Answers (Displays when game is over) */}
      {isGameOver && (
        <div className="found-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '30px' }}>
          <div>
            <h2>🏆 Leaderboard</h2>
            <div style={{ textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
              {isLoadingLeaderboard ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading leaderboard...</p>
              ) : leaderboard.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No scores yet for this length! Be the first!</p>
              ) : (
                <ol style={{ paddingLeft: '20px' }}>
                  {leaderboard.map((item, idx) => (
                    <li key={idx} style={{ marginBottom: '8px', color: item.username === username ? 'var(--accent)' : 'inherit' }}>
                      <strong>{item.username}</strong>: {item.score} pts
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <div>
            <h2>📚 Missed Words</h2>
            <div className="found-words-list" style={{ justifyContent: 'left' }}>
              {answers.map((word, idx) => {
                const isFound = foundWords.includes(word);
                return (
                  <span 
                    key={idx} 
                    className="word-tag"
                    style={{ 
                      background: isFound ? 'rgba(57, 255, 20, 0.08)' : 'rgba(255, 49, 49, 0.08)',
                      borderColor: isFound ? 'rgba(57, 255, 20, 0.3)' : 'rgba(255, 49, 49, 0.3)',
                      color: isFound ? 'var(--success)' : 'var(--error)'
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active Found Words (During gameplay only) */}
      {!isGameOver && foundWords.length > 0 && (
        <div className="found-section">
          <h2>Correct Words</h2>
          <div className="found-words-list">
            {foundWords.map((word, idx) => (
              <span key={idx} className="word-tag">
                {word}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
