import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/constants';
import './Admin.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('@BemEstar:adminToken', data.token);
        navigate('/admin');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Erro de conexão ao tentar fazer login.');
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Área Administrativa</h2>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label>Usuário</label>
          <input 
            type="text" 
            value={username} 
            onChange={e => setUsername(e.target.value)}
            required 
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
        <button type="submit" className="login-btn">Entrar</button>
      </form>
    </div>
  );
}
