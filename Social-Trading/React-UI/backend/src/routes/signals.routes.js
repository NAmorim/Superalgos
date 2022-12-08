const express = require('express');
const postController = require('../controllers/signals.controller');

const router = express.Router();

router
    .route('')
    .post(signalsController.listenSignals);

module.exports = router;