const supabase = require('../config/supabase');

class AdminUserController {
  async listUsers(req, res) {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase não configurado no backend.' });
    }

    try {
      // 1. Busca os IDs na tabela 'admins'
      const { data: adminRows, error: adminErr } = await supabase
        .from('admins')
        .select('user_id, created_at');

      if (adminErr) throw adminErr;

      const adminUserIds = new Set((adminRows || []).map(a => a.user_id));

      // 2. Busca lista de usuários no Supabase Auth
      const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;

      // 3. Cruza os dados para retornar apenas administradores
      const adminUsers = (users || [])
        .filter(u => adminUserIds.has(u.id))
        .map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          isCurrent: req.user && (req.user.id === u.id || req.user.email === u.email)
        }));

      res.json({ users: adminUsers });
    } catch (err) {
      console.error('Erro ao listar administradores:', err);
      res.status(500).json({ error: 'Erro ao carregar lista de administradores: ' + err.message });
    }
  }

  async createUser(req, res) {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase não configurado no backend.' });
    }

    const { email, password } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Forneça um endereço de e-mail válido.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'A senha inicial deve ter no mínimo 6 caracteres.' });
    }

    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Cria o usuário com confirmação de e-mail automática no Supabase Auth
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true
      });

      if (createErr) {
        if (createErr.message.includes('already been registered') || createErr.message.includes('unique')) {
          return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
        }
        throw createErr;
      }

      if (!newUser || !newUser.user) {
        throw new Error('Falha ao instanciar usuário no Supabase Auth.');
      }

      // 2. Adiciona o usuário na tabela de administradores 'admins'
      const { error: adminErr } = await supabase
        .from('admins')
        .upsert({ user_id: newUser.user.id }, { onConflict: 'user_id' });

      if (adminErr) {
        // Se falhou ao promover, remove o usuário criado para não deixar órfão
        await supabase.auth.admin.deleteUser(newUser.user.id);
        throw adminErr;
      }

      res.status(201).json({
        success: true,
        message: 'Administrador criado com sucesso!',
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          created_at: newUser.user.created_at
        }
      });
    } catch (err) {
      console.error('Erro ao criar administrador:', err);
      res.status(500).json({ error: 'Erro ao criar conta administrativa: ' + err.message });
    }
  }

  async deleteUser(req, res) {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase não configurado no backend.' });
    }

    const { id } = req.params;

    // Impede o admin atual de deletar a própria conta
    if (req.user && (req.user.id === id || req.user.email === id)) {
      return res.status(400).json({ error: 'Você não pode remover sua própria conta de administrador enquanto estiver conectado.' });
    }

    try {
      // 1. Remove da tabela admins
      const { error: adminErr } = await supabase
        .from('admins')
        .delete()
        .eq('user_id', id);

      if (adminErr) throw adminErr;

      // 2. Deleta o usuário do Supabase Auth
      const { error: deleteErr } = await supabase.auth.admin.deleteUser(id);
      if (deleteErr) throw deleteErr;

      res.json({ success: true, message: 'Administrador removido com sucesso.' });
    } catch (err) {
      console.error('Erro ao deletar administrador:', err);
      res.status(500).json({ error: 'Erro ao remover administrador: ' + err.message });
    }
  }
}

module.exports = new AdminUserController();
