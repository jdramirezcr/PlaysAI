const homeController = require('../controllers/homeController');
const minesweeperRoutes = require('./minesweeperRoutes');
const tictactoeRoutes = require('./tictactoeRoutes');
const blackjackRoutes = require('./blackjackRoutes');
const scoreRoutes = require('./scoreRoutes');

module.exports = (app) => {
  app.get('/', homeController.showHome);
  app.use('/minesweeper', minesweeperRoutes);
  app.use('/tictactoe', tictactoeRoutes);
  app.use('/blackjack', blackjackRoutes);
  app.use('/api/scores', scoreRoutes);
};
