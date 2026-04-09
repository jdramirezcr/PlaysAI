const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/minesweeperController');

router.get('/', ctrl.getScores);
router.post('/', ctrl.submitScore);

module.exports = router;
