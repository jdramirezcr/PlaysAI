const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../database/playsai.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT    NOT NULL DEFAULT 'Anonymous',
    difficulty  TEXT    NOT NULL CHECK(difficulty IN ('easy','medium','hard')),
    click_count INTEGER NOT NULL CHECK(click_count > 0),
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_scores_difficulty_clicks
    ON scores (difficulty, click_count ASC);
`);

module.exports = db;
