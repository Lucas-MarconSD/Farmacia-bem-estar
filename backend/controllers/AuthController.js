const UserRepository = require('../repositories/UserRepository');
const { comparePassword, hashPassword } = require('../security/password');
const { signToken } = require('../security/jwt');

class AuthController {
  login(req, res) {
    const { username, password } = req.body;
    
    if (!username || !password) {
      req.rateLimit.increment();
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    try {
      const user = UserRepository.findByUsername(username);

      if (!user || !comparePassword(password, user.password)) {
        req.rateLimit.increment();
        return res.status(401).json({ error: 'Usuário ou senha inválidos' });
      }

      req.rateLimit.clear();
      // Include a slice of the password hash to invalidate tokens if password changes
      const passSlice = user.password.slice(-10);
      const token = signToken({ id: user.id, username: user.username, role: user.role, passSlice });
      res.json({ token, user: { username: user.username, role: user.role } });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  changePassword(req, res) {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'A nova senha e a confirmação não coincidem.' });
    }

    // Policy: at least 8 chars, 1 letter, 1 number
    const policyRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!policyRegex.test(newPassword)) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres, incluindo uma letra e um número.' });
    }

    try {
      const user = UserRepository.findById(userId);
      if (!user || !comparePassword(currentPassword, user.password)) {
        return res.status(401).json({ error: 'Senha atual incorreta.' });
      }

      UserRepository.updatePassword(userId, hashPassword(newPassword));
      res.json({ success: true, message: 'Senha alterada com sucesso.' });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }
}

module.exports = new AuthController();
