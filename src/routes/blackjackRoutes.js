const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/blackjackController');

router.get('/', ctrl.showPage);

module.exports = router;
