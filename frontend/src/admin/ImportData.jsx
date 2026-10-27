import React, { useState, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle, RotateCcw, History, Trash2, Database, PlusCircle, ArrowUpDown, Info } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../config/supabaseClient';

export default function ImportData() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Opções de importação
  const [stockMode, setStockMode] = useState('add'); // 'add' (Somar ao estoque atual) | 'replace' (Substituir estoque)
  const [allowCreateNew, setAllowCreateNew] = useState(true); // Permitir cadastrar novos produtos
  const [lastImport, setLastImport] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [catalogStats, setCatalogStats] = useState({ total: 0, valid: 0, ghost: 0, loading: false });

  // Carrega usuário autenticado e histórico de rollback local
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data?.user?.email?.toLowerCase() || '');
    }).catch(() => {});

    try {
      const saved = localStorage.getItem('@BemEstar:lastStockImport');
      if (saved) {
        setLastImport(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Erro ao ler histórico de importação:', e);
    }

    loadCatalogStats();
  }, []);

  // Diagnóstico do catálogo (produtos reais vs fantasmas sem preço)
  const loadCatalogStats = async () => {
    try {
      setCatalogStats(prev => ({ ...prev, loading: true }));
      const { count: total } = await supabase.from('products').select('*', { count: 'exact', head: true });
      const { count: valid } = await supabase.from('products').select('*', { count: 'exact', head: true }).gt('price', 0);
      const { count: ghost } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', '2026-10-10T00:00:00')
        .or('price.is.null,price.eq.0');

      setCatalogStats({
        total: total || 0,
        valid: valid || 0,
        ghost: ghost || 0,
        loading: false
      });
    } catch (err) {
      console.error('Erro ao carregar diagnóstico:', err);
      setCatalogStats(prev => ({ ...prev, loading: false }));
    }
  };

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

  // Busca TODOS os produtos existentes no banco sem o limite de 1000 linhas do PostgREST
  const fetchAllExistingProducts = async () => {
    let all = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, barcode, external_id, price, stock, active, category_id, image_url, description')
        .range(from, from + step - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < step) break;
      from += step;
    }
    return all;
  };

  // Normalizador universal de cabeçalhos de ERPs de farmácia (Linx, Trier, Digifarma, Inova, etc.)
  const extractRowData = (rawRow) => {
    const cleanKeys = {};
    for (const key in rawRow) {
      if (rawRow.hasOwnProperty(key)) {
        const simplifiedKey = key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        cleanKeys[simplifiedKey] = rawRow[key];
      }
    }

    const findVal = (exactMatches, partialMatches) => {
      for (const e of exactMatches) {
        if (cleanKeys[e] !== undefined && cleanKeys[e] !== null && cleanKeys[e].toString().trim() !== '') {
          return cleanKeys[e].toString().trim();
        }
      }
      for (const p of partialMatches) {
        for (const k in cleanKeys) {
          if (k.startsWith(p) || k.includes(p)) {
            const v = cleanKeys[k];
            if (v !== undefined && v !== null && v.toString().trim() !== '') {
              return v.toString().trim();
            }
          }
        }
      }
      return '';
    };

    const name = findVal(
      ['descricaodoproduto', 'descricao', 'nome', 'produto', 'item', 'medicamento'],
      ['descri', 'prod', 'nome']
    );

    const cleanCode = (val) => {
      if (!val) return '';
      let str = val.toString().trim();
      return str.replace(/\.0+$/, '').replace(/,0+$/, '').trim();
    };

    let barcode = cleanCode(findVal(
      ['codigodebarras', 'codbarras', 'barcode', 'ean', 'gtin', 'cbarras', 'eangtin'],
      ['barras', 'ean', 'gtin']
    ));

    let externalId = cleanCode(findVal(
      ['codigoproduto', 'codproduto', 'idproduto', 'externalid', 'referencia', 'codigo', 'cod'],
      ['cod', 'ref']
    ));

    // Se a coluna de barras veio vazia mas a de código tem formato típico de EAN
    if (!barcode && externalId && /^[0-9]{7,14}$/.test(externalId)) {
      barcode = externalId;
    }

    const priceStr = findVal(
      ['precovenda', 'prvenda', 'valordevenda', 'valorunitario', 'precoconsumidor', 'vlrunitario', 'vlrvenda', 'preco', 'valor', 'price'],
      ['preco', 'valor', 'venda', 'prvenda']
    );

    const stockStr = findVal(
      ['estoqueatual', 'qtdestoque', 'saldofisico', 'estoquedisponivel', 'estoque', 'quantidade', 'saldo', 'qtde', 'qtd', 'quant', 'stock'],
      ['estoque', 'saldo', 'qtd', 'quant']
    );

    let price = parseFloat(priceStr.replace(',', '.'));
    if (isNaN(price)) price = null;

    let hasStockInRow = stockStr !== '';
    let parsedStock = hasStockInRow ? parseInt(stockStr.replace(/[^0-9-]/g, ''), 10) : 0;
    if (isNaN(parsedStock)) parsedStock = 0;

    return {
      name,
      barcode,
      externalId,
      price,
      hasStockInRow,
      parsedStock
    };
  };

  const uploadFile = async (isPreview = true) => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      // 1. Carrega todos os produtos do banco paginados
      const existingProducts = await fetchAllExistingProducts();

      // 2. Mapeamentos rápidos O(1) por código de barras, external_id e nome normalizado
      const barcodeMap = new Map();
      const extIdMap = new Map();
      const nameMap = new Map();

      existingProducts.forEach(p => {
        // NUNCA indexa por códigos corrompidos com E+
        if (p.barcode && p.barcode.toString().trim() && !/e\+/i.test(p.barcode)) {
          barcodeMap.set(p.barcode.toString().trim(), p);
        }
        if (p.external_id && p.external_id.toString().trim() && !/e\+/i.test(p.external_id)) {
          extIdMap.set(p.external_id.toString().trim(), p);
        }
        if (p.name && p.name.trim()) {
          const normName = p.name.trim().toLowerCase().replace(/\s+/g, ' ');
          if (!nameMap.has(normName) || (p.price && p.price > 0)) {
            nameMap.set(normName, p);
          }
        }
      });

      // 3. Lê o CSV
      const rawRows = await parseCSV(file);
      const rows = rawRows.filter(row => {
        return Object.values(row).some(val => val !== null && val !== undefined && val.toString().trim() !== '');
      });

      let summary = {
        totalAnalyzed: rows.length,
        newProducts: 0,
        ignoredNew: 0,
        stockIncreased: 0,
        stockDecreased: 0,
        priceChanged: 0,
        nameChanged: 0,
        unchanged: 0,
        review: 0,
        invalidRow: 0,
        invalidEan: 0,
        duplicateEan: 0
      };

      const eanSet = new Set();
      const toUpdateMap = new Map();
      const toInsertMap = new Map();

      rows.forEach(rawRow => {
        const { name, barcode, externalId, price, hasStockInRow, parsedStock } = extractRowData(rawRow);

        if (!name) {
          summary.invalidRow++;
          return;
        }

        if (barcode && /[^0-9]/.test(barcode)) {
          summary.invalidEan++;
        }

        if (barcode) {
          if (eanSet.has(barcode)) summary.duplicateEan++;
          eanSet.add(barcode);
        }

        if (!price || price <= 0) {
          summary.review++;
        }

        // Localiza se o produto já existe no banco
        let existing = null;
        if (barcode && barcodeMap.has(barcode)) {
          existing = barcodeMap.get(barcode);
        } else if (externalId && extIdMap.has(externalId)) {
          existing = extIdMap.get(externalId);
        } else {
          const norm = name.toLowerCase().replace(/\s+/g, ' ');
          if (nameMap.has(norm)) {
            existing = nameMap.get(norm);
          }
        }

        if (!existing) {
          // PRODUTO NOVO
          if (!allowCreateNew) {
            summary.ignoredNew++;
          } else {
            const insertKey = barcode ? `ean:${barcode}` : `name:${name.toLowerCase().trim()}`;
            if (!toInsertMap.has(insertKey)) {
              summary.newProducts++;
              toInsertMap.set(insertKey, {
                name,
                barcode: barcode || null,
                external_id: externalId || null,
                price: price || null,
                stock: hasStockInRow ? parsedStock : 0,
                active: true,
                category_id: 1 // Medicamentos como padrão
              });
            } else {
              // Se repetiu na planilha, soma ou atualiza
              const prev = toInsertMap.get(insertKey);
              toInsertMap.set(insertKey, {
                ...prev,
                price: price || prev.price,
                stock: stockMode === 'add' ? (prev.stock + parsedStock) : parsedStock,
                active: true
              });
            }
          }
        } else {
          // PRODUTO EXISTENTE
          let changed = false;

          // Cálculo do novo estoque conforme modo escolhido
          let finalStock = existing.stock || 0;
          if (hasStockInRow) {
            if (stockMode === 'add') {
              finalStock = (existing.stock || 0) + parsedStock;
            } else {
              finalStock = parsedStock;
            }
          }

          if (finalStock > existing.stock) {
            summary.stockIncreased++;
            changed = true;
          } else if (finalStock < existing.stock) {
            summary.stockDecreased++;
            changed = true;
          }

          if (price && price !== existing.price) {
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

          // Desduplicação estrita por existing.id (garante que nenhum produto seja repetido no mesmo lote do Postgres)
          const prevUpdate = toUpdateMap.get(existing.id);
          const currentAccumulatedStock = prevUpdate ? prevUpdate.stock : (existing.stock || 0);

          let updatedStock = finalStock;
          if (prevUpdate && hasStockInRow && stockMode === 'add') {
            updatedStock = currentAccumulatedStock + parsedStock;
          }

          toUpdateMap.set(existing.id, {
            ...existing,
            ...(prevUpdate || {}),
            price: price || (prevUpdate ? prevUpdate.price : existing.price),
            stock: updatedStock,
            active: true,
            ...(barcode && !/e\+/i.test(barcode) ? { barcode } : {}),
            ...(externalId && !/e\+/i.test(externalId) ? { external_id: externalId } : (/e\+/i.test(existing.external_id) ? { external_id: null } : {})),
            _originalExisting: prevUpdate ? prevUpdate._originalExisting : {
              id: existing.id,
              name: existing.name,
              stock: existing.stock,
              price: existing.price,
              active: existing.active
            }
          });
        }
      });

      const toUpdateList = Array.from(toUpdateMap.values());
      const toInsertList = Array.from(toInsertMap.values());

      if (isPreview) {
        setPreview({
          ...summary,
          toUpdateCount: toUpdateList.length,
          toInsertCount: toInsertList.length
        });
      } else {
        // EXECUÇÃO REAL COM CAPTURA DE SNAPSHOT PARA ROLLBACK
        const previousStates = toUpdateList.map(item => item._originalExisting);
        const newlyCreatedIds = [];

        // 1. Atualiza produtos existentes em lotes de 200 (garantidamente com IDs únicos)
        for (let i = 0; i < toUpdateList.length; i += 200) {
          const batch = toUpdateList.slice(i, i + 200).map(item => {
            const clean = { ...item };
            delete clean._originalExisting;
            delete clean.categories;
            return clean;
          });
          const { error: upsertErr } = await supabase.from('products').upsert(batch);
          if (upsertErr) throw upsertErr;
        }

        // 2. Insere novos produtos se permitido (desduplicados)
        if (toInsertList.length > 0) {
          for (let i = 0; i < toInsertList.length; i += 200) {
            const batch = toInsertList.slice(i, i + 200);
            const { data: inserted, error: insertErr } = await supabase
              .from('products')
              .insert(batch)
              .select('id');
            if (insertErr) throw insertErr;
            if (inserted) {
              newlyCreatedIds.push(...inserted.map(row => row.id));
            }
          }
        }

        // 3. Salva snapshot de Rollback no localStorage
        const rollbackRecord = {
          id: Date.now(),
          timestamp: new Date().toLocaleString('pt-BR'),
          fileName: file.name,
          userEmail: userEmail || 'Administrador',
          createdIds: newlyCreatedIds,
          previousStates: previousStates,
          summary: {
            totalProcessed: rows.length,
            newCreated: newlyCreatedIds.length,
            updated: previousStates.length,
            ignored: summary.ignoredNew,
            mode: stockMode === 'add' ? 'Somar ao estoque' : 'Substituir estoque'
          }
        };

        try {
          localStorage.setItem('@BemEstar:lastStockImport', JSON.stringify(rollbackRecord));
          setLastImport(rollbackRecord);
        } catch (e) {
          console.warn('Erro ao salvar snapshot de rollback:', e);
        }

        setSuccess(`Atualização de estoque realizada com sucesso! ${toUpdateList.length} produtos atualizados${newlyCreatedIds.length > 0 ? ` e ${newlyCreatedIds.length} novos produtos adicionados ao catálogo` : ''}.`);
        setPreview(null);
        setFile(null);
        if (document.getElementById('file-upload')) {
          document.getElementById('file-upload').value = '';
        }
        loadCatalogStats();
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro durante o processamento do arquivo.');
    }
    setLoading(false);
  };

  // DESFAZER O ÚLTIMO ENVIO (ROLLBACK TOTAL)
  const handleRollback = async () => {
    if (!lastImport) return;

    const numCreated = lastImport.createdIds?.length || 0;
    const numUpdated = lastImport.previousStates?.length || 0;

    const confirmMsg = `Tem certeza que deseja desfazer a importação de ${lastImport.timestamp} (${lastImport.fileName})?\n\n` +
      `- ${numCreated} novos produtos criados serão EXCLUÍDOS permanentemente.\n` +
      `- ${numUpdated} produtos alterados voltarão ao estoque e preço anteriores.\n\n` +
      `Essa ação é imediata e restaurará o catálogo exatamente como estava antes.`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    setError('');

    try {
      // 1. Exclui novos produtos criados naquele lote
      if (numCreated > 0) {
        for (let i = 0; i < lastImport.createdIds.length; i += 200) {
          const batch = lastImport.createdIds.slice(i, i + 200);
          const { error: delErr } = await supabase.from('products').delete().in('id', batch);
          if (delErr) throw delErr;
        }
      }

      // 2. Restaura o estoque, preço e status dos produtos alterados (desduplicados por ID)
      if (numUpdated > 0) {
        const uniquePrevMap = new Map();
        (lastImport.previousStates || []).forEach(p => {
          if (p && p.id && !uniquePrevMap.has(p.id)) {
            uniquePrevMap.set(p.id, p);
          }
        });
        const cleanPrevious = Array.from(uniquePrevMap.values());
        for (let i = 0; i < cleanPrevious.length; i += 200) {
          const batch = cleanPrevious.slice(i, i + 200);
          const { error: restoreErr } = await supabase.from('products').upsert(batch);
          if (restoreErr) throw restoreErr;
        }
      }

      localStorage.removeItem('@BemEstar:lastStockImport');
      setLastImport(null);
      setSuccess(`Envio desfeito com sucesso! ${numCreated} produtos novos foram removidos e ${numUpdated} produtos retornaram aos estoques/preços originais.`);
      loadCatalogStats();

    } catch (err) {
      console.error('Erro ao reverter envio:', err);
      setError(`Erro ao reverter: ${err.message}`);
    }
    setLoading(false);
  };

  // LIMPEZA SEGURA DOS PRODUTOS FANTASMAS
  const handleCleanGhostProducts = async () => {
    if (catalogStats.ghost === 0) return;

    const confirmMsg = `Atenção: Essa ação irá excluir os ${catalogStats.ghost} produtos antigos que estão com preço nulo e estoque zerado.\n\n` +
      `Os seus ${catalogStats.valid} produtos reais (com preço e estoque válidos) NÃO serão afetados.\n\n` +
      `Deseja prosseguir com a limpeza e deixar apenas os produtos reais na loja?`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    setError('');

    try {
      let ghostIds = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('id')
          .lt('created_at', '2026-10-10T00:00:00')
          .or('price.is.null,price.eq.0')
          .range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        ghostIds.push(...data.map(d => d.id));
        if (data.length < step) break;
        from += step;
      }

      for (let i = 0; i < ghostIds.length; i += 200) {
        const batch = ghostIds.slice(i, i + 200);
        const { error: delErr } = await supabase.from('products').delete().in('id', batch);
        if (delErr) throw delErr;
      }

      setSuccess(`Limpeza concluída! ${ghostIds.length} produtos fantasmas foram removidos. Sua loja agora conta com os produtos reais.`);
      loadCatalogStats();

    } catch (err) {
      console.error('Erro ao limpar produtos fantasmas:', err);
      setError(`Erro na limpeza: ${err.message}`);
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
          <h2 style={{ marginTop: 16, color: '#059669' }}>Processando dados com segurança...</h2>
          <p style={{ color: '#4b5563', margin: 0 }}>Consultando e comparando todos os registros no Supabase.</p>
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
          <div>
            <h1 style={{ margin: 0 }}>Atualizar Estoque</h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
              Importe ou atualize produtos e estoque com suporte a soma de saldo, cadastro automático e opção de desfazer.
            </p>
          </div>
        </div>

        {/* ALERTA DE SUCESSO OU ERRO */}
        {error && (
          <div className="login-error" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {success && (
          <div style={{
            backgroundColor: '#def7ec',
            color: '#03543f',
            padding: 16,
            borderRadius: 8,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 20,
            border: '1px solid #bcf0da'
          }}>
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {/* CARD: DESFAZER ÚLTIMO ENVIO DE ESTOQUE (ROLLBACK) */}
        {lastImport && (
          <div style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: 10,
            padding: 18,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontWeight: 700, fontSize: '1.05rem' }}>
                  <History size={20} />
                  Último Envio de Estoque Registrado
                </div>
                <div style={{ marginTop: 8, color: '#78350f', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  <div><strong>Arquivo:</strong> {lastImport.fileName}</div>
                  <div><strong>Data:</strong> {lastImport.timestamp} • <strong>Usuário:</strong> {lastImport.userEmail}</div>
                  <div style={{ marginTop: 4, color: '#b45309' }}>
                    <strong>Resumo:</strong> {lastImport.summary?.updated || 0} produtos atualizados • {lastImport.createdIds?.length || 0} novos produtos inseridos ({lastImport.summary?.mode || 'Atualização'})
                  </div>
                </div>
              </div>
              <button
                onClick={handleRollback}
                disabled={loading}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.925rem',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                <RotateCcw size={18} />
                Desfazer Este Envio (Reverter Estoque)
              </button>
            </div>
          </div>
        )}

        {/* ÁREA DE IMPORTAÇÃO */}
        <div className="import-steps" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: '#111827' }}>
            1. Configurar Modo de Importação & Estoque
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
            {/* CONFIGURAÇÃO DO ESTOQUE (SOMAR OU SUBSTITUIR) */}
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontWeight: 700, fontSize: '0.95rem', marginBottom: 10 }}>
                <ArrowUpDown size={18} />
                Como tratar o estoque da planilha?
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#15803d', fontSize: '0.9rem', marginBottom: 8 }}>
                <input
                  type="radio"
                  name="stockMode"
                  value="add"
                  checked={stockMode === 'add'}
                  onChange={() => { setStockMode('add'); setPreview(null); }}
                  style={{ accentColor: '#16a34a' }}
                />
                <span><strong>Somar ao estoque atual</strong> (Recomendado para chegada de mercadorias / compras)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#15803d', fontSize: '0.9rem' }}>
                <input
                  type="radio"
                  name="stockMode"
                  value="replace"
                  checked={stockMode === 'replace'}
                  onChange={() => { setStockMode('replace'); setPreview(null); }}
                  style={{ accentColor: '#16a34a' }}
                />
                <span><strong>Substituir estoque</strong> (Balanço geral / Inventário físico completo)</span>
              </label>
            </div>

            {/* CONFIGURAÇÃO DE PRODUTOS NOVOS */}
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1e40af', fontWeight: 700, fontSize: '0.95rem', marginBottom: 10 }}>
                <PlusCircle size={18} />
                Produtos não encontrados no site:
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', color: '#1d4ed8', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={allowCreateNew}
                  onChange={(e) => { setAllowCreateNew(e.target.checked); setPreview(null); }}
                  style={{ width: 17, height: 17, marginTop: 2, accentColor: '#2563eb' }}
                />
                <span>
                  <strong>Cadastrar novos produtos na loja virtual</strong>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: '#3b82f6', marginTop: 2 }}>
                    Se a planilha contiver itens que ainda não existem no site, eles serão inseridos e aparecerão no catálogo.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: '#111827' }}>
            2. Selecionar Arquivo (.CSV ou Excel)
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#4b5563', fontSize: '0.9rem' }}>
            Selecione a planilha exportada pelo seu sistema de farmácia (aceita colunas como <em>PRODUTO, DESCRIÇÃO, EAN, CÓDIGO BARRAS, PREÇO, ESTOQUE, SALDO, QTDE</em>):
          </p>

          <input 
            id="file-upload"
            type="file" 
            accept=".csv, .xlsx, .xls"
            onChange={handleFileChange} 
            disabled={loading}
            style={{
              padding: '10px',
              border: '1px dashed #9ca3af',
              borderRadius: 6,
              width: '100%',
              backgroundColor: 'white'
            }}
          />

          {file && !preview && !success && (
            <div style={{ marginTop: 20 }}>
              <button 
                className="btn-primary" 
                onClick={() => uploadFile(true)}
                disabled={loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Upload size={18} />
                {loading ? 'Analisando...' : 'Gerar Prévia da Planilha'}
              </button>
            </div>
          )}
        </div>

        {/* PRÉVIA INTELIGENTE */}
        {preview && (
          <div className="import-preview" style={{ marginTop: 24 }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>
              Resumo da Importação ({stockMode === 'add' ? 'Modo: Somar ao Estoque Atual' : 'Modo: Substituir Estoque'})
            </h3>
            <ul>
              <li>
                <span>Total de linhas analisadas na planilha:</span>
                <strong>{preview.totalAnalyzed}</strong>
              </li>
              <li>
                <span style={{ color: '#2563eb', fontWeight: 600 }}>Produtos existentes que serão atualizados:</span>
                <strong style={{ color: '#2563eb' }}>{preview.toUpdateCount}</strong>
              </li>
              {allowCreateNew ? (
                <li>
                  <span style={{ color: '#059669', fontWeight: 600 }}>Novos produtos que SERÃO ADICIONADOS ao catálogo:</span>
                  <strong style={{ color: '#059669' }}>{preview.toInsertCount}</strong>
                </li>
              ) : (
                <li>
                  <span style={{ color: '#6b7280' }}>Itens novos na planilha (Ignorados):</span>
                  <strong style={{ color: '#6b7280' }}>{preview.ignoredNew}</strong>
                </li>
              )}
              <li>
                <span style={{ color: '#059669' }}>Produtos com Aumento de Estoque:</span>
                <strong style={{ color: '#059669' }}>{preview.stockIncreased}</strong>
              </li>
              <li>
                <span style={{ color: '#dc2626' }}>Produtos com Redução de Estoque:</span>
                <strong style={{ color: '#dc2626' }}>{preview.stockDecreased}</strong>
              </li>
              <li>
                <span style={{ color: '#7e22ce' }}>Preços ou Nomes alterados:</span>
                <strong style={{ color: '#7e22ce' }}>{preview.priceChanged + preview.nameChanged}</strong>
              </li>
              <li>
                <span style={{ color: '#4b5563' }}>Produtos com saldo idêntico (Inalterados):</span>
                <strong style={{ color: '#4b5563' }}>{preview.unchanged}</strong>
              </li>
              {preview.review > 0 && (
                <li>
                  <span style={{ color: '#eab308' }}>Produtos sem preço na planilha (Manterão preço atual):</span>
                  <strong style={{ color: '#eab308' }}>{preview.review}</strong>
                </li>
              )}
            </ul>

            {(preview.invalidRow > 0 || preview.invalidEan > 0 || preview.duplicateEan > 0) && (
              <div style={{ marginTop: 16, padding: 12, backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#b91c1c' }}>Avisos detectados no arquivo:</h4>
                <ul style={{ margin: 0, paddingLeft: 20, color: '#b91c1c' }}>
                  {preview.invalidRow > 0 && <li><strong>{preview.invalidRow}</strong> linhas sem nome de produto foram desconsideradas.</li>}
                  {preview.invalidEan > 0 && <li><strong>{preview.invalidEan}</strong> códigos de barras com caracteres inválidos.</li>}
                  {preview.duplicateEan > 0 && <li><strong>{preview.duplicateEan}</strong> códigos de barras repetidos na planilha (dados consolidados automaticamente).</li>}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button 
                className="btn-primary" 
                onClick={() => uploadFile(false)}
                disabled={loading}
              >
                <CheckCircle size={18} />
                {loading ? 'Aplicando...' : 'Confirmar e Aplicar ao Catálogo'}
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => { setPreview(null); setFile(null); if (document.getElementById('file-upload')) document.getElementById('file-upload').value = ''; }}
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* CARD: DIAGNÓSTICO DO CATÁLOGO & LIMPEZA DE FANTASMAS */}
        <div style={{
          marginTop: 32,
          padding: 20,
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 10
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={22} color="#475569" />
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>Diagnóstico Atual do Catálogo</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Total cadastrado no banco: <strong style={{ color: '#059669' }}>{catalogStats.total}</strong> produtos reais ativos | 
                  Com estoque disponível: <strong style={{ color: '#2563eb' }}>{catalogStats.valid}</strong>
                </p>
              </div>
            </div>

            {catalogStats.ghost > 0 && (
              <button
                onClick={handleCleanGhostProducts}
                disabled={loading}
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Trash2 size={15} />
                Limpar {catalogStats.ghost} Itens Antigos sem Preço
              </button>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
