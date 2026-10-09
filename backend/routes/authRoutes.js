const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { loginRateLimiter } = require('../middlewares/rateLimit');

router.post('/login', loginRateLimiter, AuthController.login);

module.exports = router;
