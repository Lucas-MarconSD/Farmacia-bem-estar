import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import './Admin.css';

const MASTER_EMAILS = [
  'lucas.marcom@gmail.com',
  'drogariabemstar2024@gmail.com'
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (signInError) {
        setError('E-mail ou senha incorretos.');
      } else if (data.session && data.user) {
        const userEmail = data.user.email?.toLowerCase();
        const isMaster = MASTER_EMAILS.includes(userEmail);
        
        let hasAccess = isMaster;

        // Se não for da lista master, valida se o usuário tem privilégio de administrador
        if (!hasAccess) {
          // 1. Tenta verificar via função RPC is_admin
          try {
            const { data: rpcAdmin } = await supabase.rpc('is_admin');
            if (rpcAdmin === true) {
              hasAccess = true;
            }
          } catch (rpcErr) {
            console.warn('Erro ao chamar is_admin RPC:', rpcErr);
          }

          // 2. Se a RPC não confirmou, tenta consultar a tabela admins
          if (!hasAccess) {
            try {
              const { data: adminRow } = await supabase
                .from('admins')
                .select('user_id')
                .eq('user_id', data.user.id)
                .maybeSingle();

              if (adminRow) {
                hasAccess = true;
              }
            } catch (tableErr) {
              console.warn('Erro ao consultar tabela admins:', tableErr);
            }
          }
        }

        if (!hasAccess) {
          await supabase.auth.signOut();
          localStorage.removeItem('@BemEstar:adminToken');
          setError('Acesso negado: Esta conta não possui privilégios de administrador.');
          return;
        }

        // Armazena o token de sessão e redireciona para o painel
        localStorage.setItem('@BemEstar:adminToken', data.session.access_token);
        navigate('/admin');
      }
    } catch (err) {
      setError('Erro de conexão ao tentar fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Área Administrativa</h2>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label>E-mail</label>
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            required 
            placeholder="seu@email.com"
          />
        </div>
        <div className="form-group">
          <label>Senha</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            required 
          />
        </div>
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Autenticando...' : 'Entrar (Supabase)'}
        </button>
      </form>
    </div>
  );
}
