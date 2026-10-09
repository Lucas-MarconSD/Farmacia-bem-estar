const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signToken = (payload, expiresIn = '8h') => {
  return jwt.sign(payload, env.SECRET_KEY, { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, env.SECRET_KEY);
};

module.exports = {
  signToken,
  verifyToken
};
