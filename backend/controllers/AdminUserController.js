const supabase = require('../config/supabase');

const MASTER_EMAIL = 'lucas.marcom@gmail.com';

class AdminUserController {
  async listUsers(req, res) {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase não configurado no backend.' });
    }

    // Camada de Defesa: Somente a conta Master pode visualizar a lista de administradores
    if (!req.user || req.user.email !== MASTER_EMAIL) {
      return res.status(403).json({ error: 'Acesso negado. Apenas a conta Master tem permissão para listar a equipe.' });
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
        .filter(u => adminUserIds.has(u.id) || u.email === MASTER_EMAIL)
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

    // Camada de Defesa: Somente a conta Master pode cadastrar novos administradores
    if (!req.user || req.user.email !== MASTER_EMAIL) {
      return res.status(403).json({ error: 'Acesso negado. Apenas a conta Master tem permissão para cadastrar administradores.' });
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
      let targetUserId = null;
      let targetUserEmail = cleanEmail;
      let targetCreatedAt = new Date().toISOString();

      // 1. Cria o usuário com confirmação de e-mail automática no Supabase Auth
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true
      });

      if (createErr) {
        if (createErr.message.includes('already been registered') || createErr.message.includes('unique')) {
          // Usuário já foi instanciado pelo cliente isolado no frontend, recupera ID
          const { data: { users: allUsers } } = await supabase.auth.admin.listUsers();
          const existing = (allUsers || []).find(u => u.email?.toLowerCase() === cleanEmail);
          if (!existing) {
            return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
          }
          targetUserId = existing.id;
          targetUserEmail = existing.email;
          targetCreatedAt = existing.created_at;
          await supabase.auth.admin.updateUserById(targetUserId, { email_confirm: true }).catch(() => {});
        } else {
          throw createErr;
        }
      } else {
        targetUserId = newUser?.user?.id;
        targetUserEmail = newUser?.user?.email;
        targetCreatedAt = newUser?.user?.created_at;
      }

      if (!targetUserId) {
        throw new Error('Falha ao obter ID do usuário no Supabase Auth.');
      }

      // 2. Garante registro na tabela de administradores 'admins'
      const { error: adminErr } = await supabase
        .from('admins')
        .upsert({ user_id: targetUserId }, { onConflict: 'user_id' });

      if (adminErr) {
        throw adminErr;
      }

      res.status(201).json({
        success: true,
        message: 'Administrador registrado com sucesso!',
        user: {
          id: targetUserId,
          email: targetUserEmail,
          created_at: targetCreatedAt
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

    // Camada de Defesa: Somente a conta Master pode revogar acessos
    if (!req.user || req.user.email !== MASTER_EMAIL) {
      return res.status(403).json({ error: 'Acesso negado. Apenas a conta Master tem permissão para revogar acessos.' });
    }

    const { id } = req.params;

    // Camada de Defesa: Impede remoção da própria conta na sessão ativa
    if (req.user && (req.user.id === id || req.user.email === id)) {
      return res.status(400).json({ error: 'Você não pode remover sua própria conta de administrador enquanto estiver conectado.' });
    }

    // Camada de Defesa: Protege a conta Master de qualquer exclusão
    try {
      const { data: targetUser } = await supabase.auth.admin.getUserById(id);
      if (targetUser?.user?.email === MASTER_EMAIL) {
        return res.status(403).json({ error: 'A conta Master é protegida e não pode ser removida.' });
      }
    } catch (e) {}

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
