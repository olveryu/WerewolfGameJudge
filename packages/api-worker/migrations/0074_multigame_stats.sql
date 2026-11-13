CREATE TABLE avalon_user_stats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('merlin', 'percival', 'loyalServant', 'morgana', 'assassin', 'mordred', 'oberon', 'minion')),
  games_played INTEGER NOT NULL CHECK (typeof(games_played) = 'integer' AND games_played >= 0),
  wins INTEGER NOT NULL CHECK (typeof(wins) = 'integer' AND wins >= 0 AND wins <= games_played),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE undercover_user_stats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('civilian', 'undercover', 'blank')),
  games_played INTEGER NOT NULL CHECK (typeof(games_played) = 'integer' AND games_played >= 0),
  wins INTEGER NOT NULL CHECK (typeof(wins) = 'integer' AND wins >= 0 AND wins <= games_played),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE drawguess_user_stats (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL CHECK (typeof(games_played) = 'integer' AND games_played >= 0),
  guess_attempts INTEGER NOT NULL CHECK (typeof(guess_attempts) = 'integer' AND guess_attempts >= 0),
  guess_rounds INTEGER NOT NULL CHECK (typeof(guess_rounds) = 'integer' AND guess_rounds >= 0),
  guessed_rounds INTEGER NOT NULL CHECK (typeof(guessed_rounds) = 'integer' AND guessed_rounds >= 0 AND guessed_rounds <= guess_rounds),
  guess_time_ms INTEGER NOT NULL CHECK (typeof(guess_time_ms) = 'integer' AND guess_time_ms >= 0),
  guess_timed_rounds INTEGER NOT NULL CHECK (typeof(guess_timed_rounds) = 'integer' AND guess_timed_rounds >= 0 AND guess_timed_rounds <= guessed_rounds),
  drawing_rounds INTEGER NOT NULL CHECK (typeof(drawing_rounds) = 'integer' AND drawing_rounds >= 0),
  guessed_drawing_rounds INTEGER NOT NULL CHECK (typeof(guessed_drawing_rounds) = 'integer' AND guessed_drawing_rounds >= 0 AND guessed_drawing_rounds <= drawing_rounds),
  total_score INTEGER NOT NULL CHECK (typeof(total_score) = 'integer' AND total_score >= 0),
  flowers_received INTEGER NOT NULL CHECK (typeof(flowers_received) = 'integer' AND flowers_received >= 0),
  eggs_received INTEGER NOT NULL CHECK (typeof(eggs_received) = 'integer' AND eggs_received >= 0),
  tomatoes_received INTEGER NOT NULL CHECK (typeof(tomatoes_received) = 'integer' AND tomatoes_received >= 0)
);

CREATE TABLE fibking_user_stats (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL CHECK (typeof(games_played) = 'integer' AND games_played >= 0),
  guesser_rounds INTEGER NOT NULL CHECK (typeof(guesser_rounds) = 'integer' AND guesser_rounds >= 0),
  honest_rounds INTEGER NOT NULL CHECK (typeof(honest_rounds) = 'integer' AND honest_rounds >= 0),
  fibber_rounds INTEGER NOT NULL CHECK (typeof(fibber_rounds) = 'integer' AND fibber_rounds >= 0),
  honest_found_rounds INTEGER NOT NULL CHECK (typeof(honest_found_rounds) = 'integer' AND honest_found_rounds >= 0 AND honest_found_rounds <= guesser_rounds),
  honest_revealed_rounds INTEGER NOT NULL CHECK (typeof(honest_revealed_rounds) = 'integer' AND honest_revealed_rounds >= 0 AND honest_revealed_rounds <= honest_rounds),
  fibber_revealed_count INTEGER NOT NULL CHECK (typeof(fibber_revealed_count) = 'integer' AND fibber_revealed_count >= 0)
);

CREATE TABLE pictionary_user_stats (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL CHECK (typeof(games_played) = 'integer' AND games_played >= 0),
  text_submissions INTEGER NOT NULL CHECK (typeof(text_submissions) = 'integer' AND text_submissions >= 0),
  drawing_submissions INTEGER NOT NULL CHECK (typeof(drawing_submissions) = 'integer' AND drawing_submissions >= 0)
);

CREATE TABLE storyrelay_user_stats (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL CHECK (typeof(games_played) = 'integer' AND games_played >= 0),
  paragraphs_submitted INTEGER NOT NULL CHECK (typeof(paragraphs_submitted) = 'integer' AND paragraphs_submitted >= 0)
);
