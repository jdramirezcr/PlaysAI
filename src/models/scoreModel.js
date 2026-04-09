const db = require('./db');

const insertScore = db.prepare(`
  INSERT INTO scores (player_name, difficulty, click_count)
  VALUES (@playerName, @difficulty, @clickCount)
`);

const getTopScores = db.prepare(`
  SELECT player_name, difficulty, click_count, created_at
  FROM scores
  WHERE difficulty = ?
  ORDER BY click_count ASC
  LIMIT 10
`);

module.exports = {
  insertScore: (playerName, difficulty, clickCount) =>
    insertScore.run({ playerName, difficulty, clickCount }),

  getTopScores: (difficulty) =>
    getTopScores.all(difficulty),
};
