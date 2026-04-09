const scoreModel = require('../models/scoreModel');

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

exports.showPage = (req, res) => {
  const scores = scoreModel.getTopScores('easy');
  res.render('minesweeper', { scores });
};

exports.submitScore = (req, res) => {
  const { playerName, difficulty, clickCount } = req.body;

  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: 'Dificultad inválida' });
  }
  if (!Number.isInteger(clickCount) || clickCount < 1) {
    return res.status(400).json({ error: 'clickCount inválido' });
  }

  const name = (typeof playerName === 'string' ? playerName.trim() : '') || 'Anonymous';
  scoreModel.insertScore(name.slice(0, 30), difficulty, clickCount);
  res.json({ ok: true });
};

exports.getScores = (req, res) => {
  const { difficulty } = req.query;
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: 'Dificultad inválida' });
  }
  const scores = scoreModel.getTopScores(difficulty);
  res.json({ difficulty, scores });
};
