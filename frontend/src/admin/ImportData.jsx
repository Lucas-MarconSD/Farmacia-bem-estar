import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { API_URL } from '../config/constants';

export default function ImportData() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setError('');
      setSuccess('');
    }
  };

  const uploadFile = async (isPreview = true, deactivateMissing = false) => {
    if (!file) return;
    setLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('preview', isPreview);
    formData.append('deactivateMissing', deactivateMissing);

    const token = localStorage.getItem('@BemEstar:adminToken');

    try {
      const res = await fetch(`${API_URL}/admin/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        if (isPreview) {
          setPreview(data.summary);
        } else {
          setSuccess('Atualização realizada com sucesso!');
          setPreview(null);
          setFile(null);
          // reset file input
          document.getElementById('file-upload').value = '';
        }
      } else {
        setError(data.error || 'Erro desconhecido');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    }
    setLoading(false);
  };

  return (
    <>
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            width: 50, height: 50,
            border: '5px solid #e5e7eb',
            borderTopColor: '#059669',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <h2 style={{marginTop: 16, color: '#059669'}}>Processando dados, por favor aguarde...</h2>
          <p style={{color: '#4b5563', margin: 0}}>Não feche ou mude de tela.</p>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )}
      <div className="admin-card">
        <div className="admin-header">
          <h1>Atualizar Estoque</h1>
        </div>

      <div className="import-steps">
        <p>Selecione um arquivo Excel (.csv) exportado pelo seu sistema de estoque.</p>
        <div style={{marginTop: 16}}>
          <input 
            id="file-upload"
            type="file" 
            accept=".csv, .xlsx, .xls"
            onChange={handleFileChange} 
            disabled={loading}
          />
        </div>

        {file && !preview && !success && (
          <div style={{marginTop: 24}}>
            <button 
              className="btn-primary" 
              onClick={() => uploadFile(true)}
              disabled={loading}
            >
              {loading ? 'Analisando...' : 'Gerar Prévia'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="login-error" style={{display: 'flex', gap: 8, alignItems: 'center'}}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div style={{backgroundColor: '#def7ec', color: '#03543f', padding: 16, borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24}}>
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      {preview && (
        <div className="import-preview">
          <h3 style={{marginTop: 0}}>Resumo Inteligente da Sincronização</h3>
          <ul>
            <li>
              <span>Total de registros no arquivo:</span>
              <strong>{preview.totalAnalyzed}</strong>
            </li>
            <li>
              <span style={{color: '#059669'}}>Novos produtos detectados (Serão criados):</span>
              <strong style={{color: '#059669'}}>{preview.newProducts}</strong>
            </li>
            <li>
              <span style={{color: '#2563eb'}}>Aumentos de Estoque:</span>
              <strong style={{color: '#2563eb'}}>{preview.stockIncreased}</strong>
            </li>
            <li>
              <span style={{color: '#dc2626'}}>Reduções de Estoque (Baixas):</span>
              <strong style={{color: '#dc2626'}}>{preview.stockDecreased}</strong>
            </li>
            <li>
              <span style={{color: '#7e22ce'}}>Preços / Nomes / Categorias alterados:</span>
              <strong style={{color: '#7e22ce'}}>{preview.priceChanged + preview.nameChanged + preview.categoryChanged}</strong>
            </li>
            <li>
              <span style={{color: '#4b5563'}}>Produtos Inalterados (Ignorados):</span>
              <strong style={{color: '#4b5563'}}>{preview.unchanged}</strong>
            </li>
            <li>
              <span style={{color: '#eab308'}}>Produtos sem preço (Revisão necessária):</span>
              <strong style={{color: '#eab308'}}>{preview.review}</strong>
            </li>
          </ul>

          {(preview.invalidRow > 0 || preview.invalidEan > 0 || preview.duplicateEan > 0) && (
            <div style={{marginTop: 16, padding: 12, backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6}}>
              <h4 style={{margin: '0 0 8px 0', color: '#b91c1c'}}>Erros detectados no arquivo:</h4>
              <ul style={{margin: 0, paddingLeft: 20, color: '#b91c1c'}}>
                {preview.invalidRow > 0 && <li><strong>{preview.invalidRow}</strong> linhas sem nome do produto.</li>}
                {preview.invalidEan > 0 && <li><strong>{preview.invalidEan}</strong> EANs inválidos (Contém letras ou caracteres especiais).</li>}
                {preview.duplicateEan > 0 && <li><strong>{preview.duplicateEan}</strong> EANs duplicados na planilha.</li>}
              </ul>
            </div>
          )}

          <div style={{marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap'}}>
            <button 
              className="btn-primary" 
              onClick={() => uploadFile(false)}
              disabled={loading}
            >
              {loading ? 'Aplicando...' : 'Confirmar Sincronização'}
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => { setPreview(null); setFile(null); document.getElementById('file-upload').value = ''; }}
              disabled={loading}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
