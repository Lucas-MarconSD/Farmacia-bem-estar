const loginAttempts = new Map();

const loginRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  const attempt = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
  if (now - attempt.firstAttempt > 15 * 60 * 1000) {
    attempt.count = 0;
    attempt.firstAttempt = now;
  }
  
  if (attempt.count >= 5) {
    return res.status(429).json({ error: 'Muitas tentativas de login. Tente novamente mais tarde.' });
  }

  // Pass functions to increment/clear attempts to the request object so controller can call them
  req.rateLimit = {
    increment: () => {
      attempt.count++;
      loginAttempts.set(ip, attempt);
    },
    clear: () => {
      loginAttempts.delete(ip);
    }
  };

  next();
};

module.exports = {
  loginRateLimiter
};
