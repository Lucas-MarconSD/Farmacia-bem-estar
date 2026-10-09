import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../config/supabaseClient';

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

  const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err)
      });
    });
  };

  const uploadFile = async (isPreview = true, deactivateMissing = false) => {
    if (!file) return;
    setLoading(true);
    setError('');
    
    try {


      // 1. Fetch current products and categories from Supabase
      const { data: existingProducts, error: prodErr } = await supabase.from('products').select('*');
      const { data: categories, error: catErr } = await supabase.from('categories').select('*');
      
      if (prodErr || catErr) throw new Error('Erro ao carregar dados do Supabase para comparação.');

      // 2. Parse CSV
      const rawRows = await parseCSV(file);
      
      // Filter out completely empty rows (common in Excel exports)
      const rows = rawRows.filter(row => {
        return Object.values(row).some(val => val !== null && val !== undefined && val.toString().trim() !== '');
      });
      
      let summary = {
        totalAnalyzed: rows.length,
        newProducts: 0,
        stockIncreased: 0,
        stockDecreased: 0,
        priceChanged: 0,
        nameChanged: 0,
        categoryChanged: 0,
        unchanged: 0,
        review: 0,
        invalidRow: 0,
        invalidEan: 0,
        duplicateEan: 0
      };

      const eanSet = new Set();
      const upsertPayload = [];

      rows.forEach(rawRow => {
        // Lowercase all keys to be case-insensitive
        const row = {};
        for (const key in rawRow) {
          if (rawRow.hasOwnProperty(key)) {
            row[key.trim().toLowerCase()] = rawRow[key];
          }
        }

        // Headers normalization
        const name = row.name || row.nome || row.descricao || row.produto || row['descrição'] || '';
        let barcode = row.barcode || row.ean || row.codigo_barras || row['código de barras'] || row.codigobarras || '';
        let price = parseFloat((row.price || row.preco || row.valor || row['preço'] || '0').toString().replace(',', '.'));
        let stock = parseInt(row.stock || row.estoque || row.quantidade || row.qtd || 0, 10);
        
        if (!name.trim()) {
          summary.invalidRow++;
          return;
        }

        if (barcode && /[^0-9]/.test(barcode.trim())) {
          summary.invalidEan++;
        }

        if (barcode) {
          if (eanSet.has(barcode)) summary.duplicateEan++;
          eanSet.add(barcode);
        }

        if (!price || price <= 0) {
          summary.review++;
        }

        // Compare with existing
        let existing = null;
        if (barcode) existing = existingProducts.find(p => p.barcode === barcode);
        if (!existing) existing = existingProducts.find(p => p.name.toLowerCase() === name.toLowerCase());

        let payload = {
          name,
          barcode,
          price,
          stock,
          active: 1
        };

        if (!existing) {
          summary.newProducts++;
          upsertPayload.push(payload);
        } else {
          let changed = false;
          
          if (stock > existing.stock) {
            summary.stockIncreased++;
            changed = true;
          } else if (stock < existing.stock) {
            summary.stockDecreased++;
            changed = true;
          }

          if (price !== existing.price) {
            summary.priceChanged++;
            changed = true;
          }

          if (name !== existing.name) {
            summary.nameChanged++;
            changed = true;
          }

          if (!changed) {
            summary.unchanged++;
          }
          
          if (changed || !isPreview) {
             // For upsert, we merge with existing to preserve image_url, description, etc.
             // But we only need to do this if we are going to save, or if it changed.
             upsertPayload.push({ ...existing, ...payload });
          }
        }
      });

      if (isPreview) {
        setPreview(summary);
      } else {
        // Execute the actual save to database in batches of 500
        for (let i = 0; i < upsertPayload.length; i += 500) {
          const batch = upsertPayload.slice(i, i + 500);
          
          // Make sure we only send columns that exist in the table. 
          // (removing the joined 'categories' object if it was accidentally fetched)
          const cleanBatch = batch.map(item => {
            const cleanItem = { ...item };
            delete cleanItem.categories;
            return cleanItem;
          });

          const { error: upsertError } = await supabase.from('products').upsert(cleanBatch);
          if (upsertError) throw upsertError;
        }
        
        setSuccess(`Atualização realizada com sucesso! ${upsertPayload.length} produtos inseridos/atualizados.`);
        setPreview(null);
        setFile(null);
        document.getElementById('file-upload').value = '';
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro durante o processamento do arquivo.');
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
          <p style={{color: '#4b5563', margin: 0}}>Validando planilhas localmente via Supabase.</p>
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
