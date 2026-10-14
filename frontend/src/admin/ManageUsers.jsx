import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldCheck, UserPlus, Trash2, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff, Sparkles, User, Lock } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { API_URL } from '../config/constants';

const MASTER_EMAIL = 'lucas.marcom@gmail.com';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xhwrlvmpsddqpjfzhhwf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_OIuhc5e-K8-i4ZmCGfcVIg_4j12iZN_';

export default function ManageUsers() {
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user || null);
      setCheckingAuth(false);
    });
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('@BemEstar:adminToken');

    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        // Fallback local se o backend não estiver respondendo
        setUsers([
          { id: '1', email: MASTER_EMAIL, isCurrent: true, created_at: new Date().toISOString() }
        ]);
      }
    } catch (err) {
      setUsers([
        { id: '1', email: MASTER_EMAIL, isCurrent: true, created_at: new Date().toISOString() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.email === MASTER_EMAIL) {
      fetchUsers();
    }
  }, [currentUser]);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let generated = 'BemStar@';
    for (let i = 0; i < 4; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      return setError('Digite um e-mail válido.');
    }
    if (!password || password.length < 6) {
      return setError('A senha deve ter no mínimo 6 caracteres.');
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const targetEmail = email.trim().toLowerCase();

    try {
      // 1. Cria um segundo cliente isolado do Supabase para NÃO deslogar a sessão atual Master
      const tempSupabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      // 2. Cria a conta no Supabase Auth usando o cliente isolado
      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email: targetEmail,
        password: password
      });

      if (signUpError) {
        throw signUpError;
      }

      // 3. Garante que o novo usuário seja registrado na tabela de administradores
      const newUserId = signUpData?.user?.id;
      if (newUserId) {
        try {
          await supabase.from('admins').upsert({ user_id: newUserId }, { onConflict: 'user_id' });
        } catch (e) {
          console.warn('Erro ao inserir na tabela admins via client:', e);
        }
      }

      // 4. Notifica o backend para confirmar o e-mail e garantir permissões completas
      try {
        const token = localStorage.getItem('@BemEstar:adminToken');
        await fetch(`${API_URL}/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: targetEmail, password })
        });
      } catch (backendErr) {
        // Backend opcional, prossegue normalmente
      }

      setSuccess(`Conta criada com sucesso no Supabase para "${targetEmail}"! O dono da farmácia já pode fazer login no painel.`);
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      console.error('Erro na criação de usuário:', err);
      setError(err.message || 'Erro ao criar conta no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Tem certeza que deseja revogar o acesso de administrador para "${userEmail}"?`)) {
      return;
    }

    const token = localStorage.getItem('@BemEstar:adminToken');

    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setSuccess(`Acesso de "${userEmail}" revogado com sucesso.`);
        fetchUsers();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao revogar acesso.');
      }
    } catch (err) {
      console.error('Erro ao deletar usuário:', err);
      setError(err.message || 'Erro ao revogar conta.');
    }
  };

  if (checkingAuth) {
    return (
      <div className="admin-card" style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280' }}>
        Verificando permissões...
      </div>
    );
  }

  // Bloqueio de segurança: Apenas a conta Master tem acesso a esta tela
  if (currentUser?.email !== MASTER_EMAIL) {
    return (
      <div className="admin-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ color: '#EF725D', marginBottom: 16 }}>
          <Lock size={48} style={{ margin: '0 auto' }} />
        </div>
        <h2 style={{ color: '#1C2A25', marginBottom: 8 }}>Acesso Restrito</h2>
        <p style={{ color: '#4b5563', maxWidth: 480, margin: '0 auto 24px auto' }}>
          Esta tela de gerenciamento de equipe e criação de contas é de uso exclusivo da conta Master (<code>{MASTER_EMAIL}</code>).
        </p>
        <button className="btn-primary" onClick={() => window.location.href = '/admin'}>
          Voltar para Produtos
        </button>
      </div>
    );
  }

  return (
    <div className="admin-card">
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldCheck size={32} color="var(--color-primary, #185942)" />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Acessos / Equipe</h1>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
              Painel Master: crie e gerencie contas de acesso para o dono da farmácia e funcionários.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={fetchUsers} title="Atualizar">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ background: '#def7ec', color: '#03543f', padding: '12px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      {/* Formulário de Criação de Usuário */}
      <div style={{ background: '#f3f4f6', padding: 24, borderRadius: 10, marginBottom: 24, border: '1px solid #e5e7eb' }}>
        <h3 style={{ marginTop: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={20} color="var(--color-primary, #185942)" /> Cadastrar Nova Conta de Acesso
        </h3>
        <p style={{ margin: '0 0 16px 0', color: '#4b5563', fontSize: '0.9rem' }}>
          O novo usuário será criado diretamente no Supabase Auth sem deslogar sua sessão atual. Ele terá acesso ao catálogo, estoque e fotos.
        </p>

        <form onSubmit={handleCreateUser}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div className="form-group" style={{ flex: 1, minWidth: 260, margin: 0 }}>
              <label>E-mail do Usuário / Dono da Loja</label>
              <input
                type="email"
                placeholder="dono@farmaciabemstar.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1, minWidth: 260, margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ margin: 0 }}>Senha Inicial</label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  style={{ background: 'none', border: 'none', color: '#185942', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                >
                  <Sparkles size={14} /> Gerar Senha
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Criando no Supabase...' : 'Criar Conta no Supabase'}
          </button>
        </form>
      </div>

      {/* Lista de Administradores */}
      <h3 style={{ marginBottom: 12 }}>Equipe com Acesso Administrativo</h3>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
          Carregando contas...
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuário / E-mail</th>
                <th>Papel</th>
                <th>Data de Criação</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: u.email === MASTER_EMAIL ? '#def7ec' : '#f3f4f6',
                          color: u.email === MASTER_EMAIL ? '#03543f' : '#4b5563',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}>
                          <User size={18} />
                        </div>
                        <div>
                          <strong>{u.email}</strong>
                          {u.email === MASTER_EMAIL && (
                            <span style={{
                              marginLeft: 8,
                              fontSize: '0.75rem',
                              background: '#def7ec',
                              color: '#03543f',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontWeight: 600
                            }}>
                              Master (Você)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="status-badge status-active">
                        {u.email === MASTER_EMAIL ? 'Super Administrador' : 'Administrador'}
                      </span>
                    </td>
                    <td style={{ color: '#4b5563', fontSize: '0.9rem' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {u.email === MASTER_EMAIL ? (
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Sessão Atual</span>
                      ) : (
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 10px', color: '#EF725D' }}
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          title="Revogar Acesso"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                    Nenhum administrador encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
