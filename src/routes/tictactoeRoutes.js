const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tictactoeController');

router.get('/', ctrl.showPage);

module.exports = router;
