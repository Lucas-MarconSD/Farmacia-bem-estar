const { verifyToken } = require('../security/jwt');
const UserRepository = require('../repositories/UserRepository');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Privilégios insuficientes.' });
    }

    const user = UserRepository.findById(decoded.id);
    if (!user || (decoded.passSlice && user.password.slice(-10) !== decoded.passSlice)) {
      return res.status(401).json({ error: 'Sessão expirada. Por favor, faça login novamente.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

module.exports = authMiddleware;
