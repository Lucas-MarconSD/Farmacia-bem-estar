import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { API_URL } from '../config/constants';

export default function DotCompanyTest() {
  const [ean, setEan] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!ean.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const token = localStorage.getItem('@BemEstar:adminToken');

    try {
      const res = await fetch(`${API_URL}/admin/dotcompany-test/${ean}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          status: res.status,
          data: data
        });
      } else {
        setError({
          status: res.status,
          message: data.error || 'Erro desconhecido',
          details: data.details
        });
      }
    } catch (err) {
      setError({
        status: 500,
        message: 'Erro de conexão de rede.',
        details: err.message
      });
    }

    setLoading(false);
  };

  return (
    <div className="admin-card">
      <div className="admin-header">
        <h1>Teste DotCompany</h1>
      </div>

      <form onSubmit={handleSearch} style={{marginBottom: 24, display: 'flex', gap: 12}}>
        <div className="form-group" style={{margin: 0, flex: 1}}>
          <input
            type="text"
            placeholder="Digite o EAN ou GTIN..."
            value={ean}
            onChange={(e) => setEan(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Consultando...' : <><Search size={18} /> Consultar</>}
        </button>
      </form>

      {error && (
        <div className="login-error">
          <strong>Erro HTTP {error.status}:</strong> {error.message}
          {error.details && <div style={{fontSize: '0.8rem', marginTop: 4}}>{error.details}</div>}
        </div>
      )}

      {result && (
        <div className="import-preview">
          <h3>Resultado da API</h3>
          <p><strong>Produto encontrado!</strong></p>
          
          <ul style={{marginBottom: 24}}>
            <li>
              <span>Nome:</span>
              <strong>{result.data.nome || '-'}</strong>
            </li>
            <li>
              <span>Marca:</span>
              <strong>{result.data.marca || '-'}</strong>
            </li>
            <li>
              <span>Categoria:</span>
              <strong>{result.data.categoria || '-'}</strong>
            </li>
            <li>
              <span>EAN:</span>
              <strong>{result.data.gtin || result.data.ean || ean}</strong>
            </li>
            <li>
              <span>Status HTTP:</span>
              <strong style={{color: '#03543f'}}>{result.status} (OK)</strong>
            </li>
          </ul>

          <h4>Imagem:</h4>
          {result.data.imagem_url ? (
            <div style={{marginBottom: 16}}>
              <img 
                src={result.data.imagem_url} 
                alt={result.data.nome || 'Produto'} 
                style={{maxWidth: 200, borderRadius: 8, border: '1px solid #e5e7eb'}}
              />
              <div style={{fontSize: '0.8rem', marginTop: 8, color: '#6b7280', wordBreak: 'break-all'}}>
                URL: {result.data.imagem_url}
              </div>
            </div>
          ) : (
            <p style={{color: '#d97706', padding: 12, backgroundColor: '#fef3c7', borderRadius: 6}}>
              Produto encontrado, mas nenhuma imagem foi retornada (imagem_url: null).
            </p>
          )}

          <details style={{marginTop: 24, cursor: 'pointer'}}>
            <summary style={{fontWeight: 600, color: '#267A5A'}}>Ver JSON completo retornado pela API</summary>
            <pre style={{
              backgroundColor: '#1C2A25', 
              color: '#D7EEE2', 
              padding: 16, 
              borderRadius: 8, 
              overflowX: 'auto',
              marginTop: 12,
              fontSize: '0.85rem'
            }}>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
