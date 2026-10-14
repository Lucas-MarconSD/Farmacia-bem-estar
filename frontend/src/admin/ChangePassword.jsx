import React, { useState } from 'react';
import { X, Key } from 'lucide-react';
import { supabase } from '../config/supabaseClient';

export default function ChangePassword({ onClose, onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (newPassword.length < 6) {
      return setError('A nova senha deve ter no mínimo 6 caracteres.');
    }

    if (newPassword !== confirmPassword) {
      return setError('A nova senha e a confirmação não coincidem.');
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      onPasswordChanged();
    } catch (err) {
      setError(err.message || 'Erro ao alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2><Key size={20} /> Alterar Senha</h2>
          <button className="btn-icon" onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message" style={{ color: 'red', marginBottom: '1rem', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '4px' }}>{error}</div>}
          
          
          <div className="form-group">
            <label>Nova Senha</label>
            <input 
              type="password" 
              required 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              placeholder="Mínimo 8 caracteres, 1 letra, 1 número"
            />
          </div>
          
          <div className="form-group">
            <label>Confirmar Nova Senha</label>
            <input 
              type="password" 
              required 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
            />
          </div>

          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Alterando...' : 'Confirmar Alteração'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
