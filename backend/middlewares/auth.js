const { verifyToken } = require('../security/jwt');
const UserRepository = require('../repositories/UserRepository');
const supabase = require('../config/supabase');

const MASTER_EMAILS = [
  'lucas.marcom@gmail.com',
  'drogariabemstar2024@gmail.com'
];
const isMaster = (email) => MASTER_EMAILS.includes(email?.toLowerCase());

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  // 1. Tenta validar via Supabase (caso a autenticação venha do frontend moderno com Supabase)
  if (supabase) {
    try {
      const { data: { user }, error: sbError } = await supabase.auth.getUser(token);
      if (!sbError && user) {
        const userIsMaster = isMaster(user.email);
        const { data: adminRow } = await supabase.from('admins').select('*').eq('user_id', user.id).single();

        if (userIsMaster || adminRow) {
          // Garante que a conta master esteja sempre na tabela de admins
          if (userIsMaster && !adminRow) {
            await supabase.from('admins').upsert({ user_id: user.id }, { onConflict: 'user_id' }).catch(() => {});
          }
          req.user = { id: user.id, email: user.email, role: 'admin', isMaster: userIsMaster };
          return next();
        }
      }
    } catch (e) {
      // Ignora e tenta o token local caso ocorra erro
    }
  }

  // 2. Tenta validar via JWT local legado
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
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

module.exports = authMiddleware;
