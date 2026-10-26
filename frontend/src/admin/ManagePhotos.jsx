import React, { useState, useEffect, useRef } from 'react';
import { Search, Image as ImageIcon, UploadCloud, ChevronUp, ChevronDown, Upload, Trash2, Check, X } from 'lucide-react';
import { supabase } from '../config/supabaseClient';

export default function ManagePhotos() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState('todos'); 
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'inactive'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [globalWithoutPhoto, setGlobalWithoutPhoto] = useState(0);
  const limit = 50;
  
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  
  const fileInputRef = useRef(null);
  const bulkInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [dragHoverId, setDragHoverId] = useState(null);

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchGlobalPendingCount = async () => {
    try {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .or('image_url.is.null,image_url.eq.""');
      setGlobalWithoutPhoto(count || 0);
    } catch (e) {
      // ignore
    }
  };

  const getDbSortColumn = (field) => {
    switch (field) {
      case 'photo':
      case 'image_url':
        return 'image_url';
      case 'active':
      case 'status':
        return 'active';
      case 'category':
      case 'categoryName':
        return 'category_id';
      case 'price':
        return 'price';
      case 'stock':
        return 'stock';
      case 'external_id':
      case 'id':
        return 'id';
      case 'name':
      default:
        return 'name';
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase.from('products').select('*, categories(name)', { count: 'exact' });

    const term = debouncedSearch.trim();
    if (term) {
      query = query.or(`name.ilike.%${term}%,barcode.ilike.%${term}%,external_id.ilike.%${term}%`);
    }

    if (filter === 'com') {
      query = query.not('image_url', 'is', null).neq('image_url', '');
    } else if (filter === 'sem') {
      query = query.or('image_url.is.null,image_url.eq.""');
    }

    if (filterStatus === 'active') {
      query = query.eq('active', true);
    } else if (filterStatus === 'inactive') {
      query = query.eq('active', false);
    }

    const dbSort = getDbSortColumn(sortField);
    if (dbSort === 'image_url') {
      // sortOrder === 'asc': sem foto primeiro (nullsFirst = true)
      // sortOrder === 'desc': com foto primeiro (nullsFirst = false)
      query = query.order('image_url', { ascending: sortOrder === 'desc', nullsFirst: sortOrder === 'asc' });
    } else {
      query = query.order(dbSort, { ascending: sortOrder === 'asc', nullsFirst: false });
    }

    // Ordenação secundária estável para que itens sem foto ou com mesmo preço respeitem A-Z / Z-A
    if (dbSort !== 'name') {
      query = query.order('name', { ascending: sortOrder === 'desc' ? false : true });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (!error && data) {
      const mapped = data.map(p => ({
        ...p,
        categoryName: p.categories?.name
      }));
      setProducts(mapped);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / limit) || 1);
    } else if (error) {
      console.error('Erro ao buscar produtos para fotos:', error);
    }
    setLoading(false);
    fetchGlobalPendingCount();
  };

  useEffect(() => {
    fetchProducts();
    setSelectedIds([]);
  }, [debouncedSearch, page, sortField, sortOrder, filter, filterStatus]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleSelectAllOnPage = () => {
    const pageIds = products.map(p => p.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleBulkActivate = async () => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    const idsToUpdate = [...selectedIds];

    setProducts(prev => prev.map(p => idsToUpdate.includes(p.id) ? { ...p, active: true } : p));

    const { error } = await supabase
      .from('products')
      .update({ active: true })
      .in('id', idsToUpdate);

    if (error) {
      alert('Erro ao ativar produtos em massa: ' + error.message);
      fetchProducts();
    } else {
      setSelectedIds([]);
      fetchProducts();
    }
    setBulkLoading(false);
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    const idsToUpdate = [...selectedIds];

    setProducts(prev => prev.map(p => idsToUpdate.includes(p.id) ? { ...p, active: false } : p));

    const { error } = await supabase
      .from('products')
      .update({ active: false })
      .in('id', idsToUpdate);

    if (error) {
      alert('Erro ao desativar produtos em massa: ' + error.message);
      fetchProducts();
    } else {
      setSelectedIds([]);
      fetchProducts();
    }
    setBulkLoading(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (!window.confirm(`Tem certeza que deseja EXCLUIR DEFINITIVAMENTE os ${count} produto(s) selecionado(s)? Esta ação removerá os produtos do banco e não poderá ser desfeita.`)) {
      return;
    }

    setBulkLoading(true);
    const idsToDelete = [...selectedIds];

    setProducts(prev => prev.filter(p => !idsToDelete.includes(p.id)));

    const { error } = await supabase
      .from('products')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      alert('Erro ao excluir produtos em massa: ' + error.message);
      fetchProducts();
    } else {
      setSelectedIds([]);
      fetchProducts();
    }
    setBulkLoading(false);
  };

  const handleToggleActive = async (p) => {
    const nextStatus = !p.active;
    setProducts(prev => prev.map(item => item.id === p.id ? { ...item, active: nextStatus } : item));

    const { error } = await supabase
      .from('products')
      .update({ active: nextStatus })
      .eq('id', p.id);

    if (error) {
      console.error('Erro ao alterar status:', error);
      alert('Não foi possível alterar o status: ' + error.message);
      fetchProducts();
    }
  };

  const sortedProducts = products;

  const uploadFile = async (file, productId) => {
    try {
      const ext = file.name.split('.').pop();
      const fileName = `product-${productId}-${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type || 'image/jpeg'
        });

      if (uploadError) {
        console.error('Erro de upload no Storage:', uploadError);
        alert(`Erro ao enviar foto para o Storage: ${uploadError.message}\n\nMotivo comum: Falta de permissão nas Políticas de Storage (RLS) no painel do Supabase.`);
        return false;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase
        .from('products')
        .update({ image_url: imageUrl })
        .eq('id', productId);

      if (dbError) {
        console.error('Erro ao salvar URL da imagem:', dbError);
        alert('Foto enviada, mas erro ao associar ao produto: ' + dbError.message);
        return false;
      }

      setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: imageUrl } : p));
      return true;
    } catch (err) {
      console.error('Erro ao fazer upload da imagem:', err);
      alert('Erro inesperado no upload: ' + err.message);
      return false;
    }
  };

  const removePhoto = async (productId) => {
    if (!window.confirm('Tem certeza que deseja remover a foto deste produto?')) return;
    
    try {
      const prod = products.find(p => p.id === productId);
      if (prod && prod.image_url && prod.image_url.includes('product-images/')) {
        const fileName = prod.image_url.split('product-images/').pop();
        if (fileName) {
          await supabase.storage.from('product-images').remove([fileName]);
        }
      }

      const { error: dbError } = await supabase
        .from('products')
        .update({ image_url: null })
        .eq('id', productId);

      if (dbError) throw dbError;

      setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: null } : p));
    } catch (err) {
      console.error('Erro ao remover foto:', err);
      alert('Erro ao remover foto: ' + err.message);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingId) return;
    const targetId = uploadingId;
    await uploadFile(file, targetId);
    e.target.value = '';
    setUploadingId(null);
  };

  const handleBulkUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setBulkUploading(true);

    let successCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = file.name.split('.')[0].trim(); 
      
      // Procura primeiro nos produtos da página atual
      let targetProduct = products.find(p => p.external_id && p.external_id.toString() === filename);

      // Se não estiver na página atual, busca no banco pelo external_id
      if (!targetProduct) {
        const { data: foundProd } = await supabase
          .from('products')
          .select('id, external_id')
          .eq('external_id', filename)
          .maybeSingle();

        if (foundProd) {
          targetProduct = foundProd;
        }
      }

      if (targetProduct) {
        const success = await uploadFile(file, targetProduct.id);
        if (success) successCount++;
      } else {
        notFoundCount++;
      }
    }
    
    alert(`Processamento em lote concluído:\n✅ ${successCount} imagem(ns) associada(s) com sucesso.${notFoundCount > 0 ? `\n⚠️ ${notFoundCount} arquivo(s) não correspondem a nenhum código externo cadastrado.` : ''}`);
    setBulkUploading(false);
    e.target.value = '';
    fetchProducts();
  };

  const onDragOver = (e, id) => {
    e.preventDefault();
    setDragHoverId(id);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    setDragHoverId(null);
  };
  const onDrop = async (e, id) => {
    e.preventDefault();
    setDragHoverId(null);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadingId(id);
      await uploadFile(file, id);
      setUploadingId(null);
    }
  };

  const totalWithoutPhoto = products.filter(p => !p.image_url || p.image_url.trim() === '').length;

  return (
    <div className="admin-card">
      <div className="admin-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <h1 style={{margin: 0}}>Gerenciar Fotos</h1>
          {globalWithoutPhoto > 0 ? (
            <button
              type="button"
              onClick={() => { setFilter('sem'); setPage(1); }}
              title="Clique para filtrar apenas produtos pendentes sem foto"
              style={{
                color: '#d97706', 
                backgroundColor: '#fef3c7', 
                border: '1px solid #fde68a',
                padding: '6px 14px', 
                borderRadius: 16, 
                fontSize: '0.85rem', 
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease'
              }}
            >
              <span>⚠️ {globalWithoutPhoto} sem foto</span>
              <span style={{ fontSize: '0.75rem', textDecoration: 'underline' }}>(Ver pendentes)</span>
            </button>
          ) : (
            <div style={{color: '#166534', backgroundColor: '#dcfce7', padding: '6px 14px', borderRadius: 16, fontSize: '0.85rem', fontWeight: 600}}>
              ✅ Todas as fotos cadastradas!
            </div>
          )}
        </div>
        <button className="btn-secondary" onClick={() => bulkInputRef.current.click()} disabled={bulkUploading}>
          <Upload size={16} />
          {bulkUploading ? 'Enviando Lote...' : 'Adicionar Várias Fotos'}
        </button>
      </div>
      
      <p style={{fontSize: '0.9rem', color: '#6b7280', marginBottom: 24}}>
        Adicione imagens individualmente, <strong>arraste e solte a foto sobre o produto</strong>, ou use o envio em lote 
        com fotos renomeadas com o ID do produto (ex: <code style={{backgroundColor:'#f3f4f6', padding:'2px 4px', borderRadius:4}}>10254.jpg</code>).
      </p>

      <div style={{display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center'}}>
        <div className="form-group" style={{margin: 0, flex: 1, minWidth: 250}}>
          <div style={{position: 'relative'}}>
            <Search style={{position: 'absolute', left: 12, top: 10, color: '#9ca3af'}} size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou código..." 
              style={{paddingLeft: 40}}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group" style={{margin: 0, width: 230}}>
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
            <option value="todos">Fotos: Todas</option>
            <option value="sem">⚠️ Somente Sem Foto (Pendentes)</option>
            <option value="com">✅ Somente Com Foto</option>
          </select>
        </div>

        <div className="form-group" style={{margin: 0, width: 180}}>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="all">Status: Todos</option>
            <option value="active">Somente Ativos</option>
            <option value="inactive">Somente Inativos</option>
          </select>
        </div>

        {(search || filter !== 'todos' || filterStatus !== 'all') && (
          <button 
            type="button" 
            className="btn-secondary" 
            style={{padding: '8px 12px', fontSize: '0.85rem'}}
            onClick={() => {
              setSearch('');
              setDebouncedSearch('');
              setFilter('todos');
              setFilterStatus('all');
              setPage(1);
            }}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{display: 'none'}} 
        accept="image/png, image/jpeg, image/webp" 
        onChange={handleFileChange}
      />
      <input 
        type="file" 
        ref={bulkInputRef} 
        style={{display: 'none'}} 
        accept="image/png, image/jpeg, image/webp" 
        multiple
        onChange={handleBulkUpload}
      />

      {selectedIds.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#185942',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          marginBottom: 16,
          gap: 16,
          flexWrap: 'wrap',
          boxShadow: '0 4px 12px rgba(24, 89, 66, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '4px 10px',
              borderRadius: 16,
              fontWeight: 700,
              fontSize: '0.85rem'
            }}>
              {selectedIds.length} produto{selectedIds.length > 1 ? 's' : ''} selecionado{selectedIds.length > 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '0.9rem', color: '#D7EEE2' }}>
              Escolha uma ação em lote:
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleBulkActivate}
              disabled={bulkLoading}
              style={{
                backgroundColor: '#22c55e',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.85rem'
              }}
              title="Ativar produtos selecionados"
            >
              <Check size={16} /> {bulkLoading ? 'Processando...' : `Ativar (${selectedIds.length})`}
            </button>

            <button
              type="button"
              onClick={handleBulkDeactivate}
              disabled={bulkLoading}
              style={{
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.85rem'
              }}
              title="Desativar produtos selecionados"
            >
              <X size={16} /> {bulkLoading ? 'Processando...' : `Desativar (${selectedIds.length})`}
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.85rem'
              }}
              title="Excluir produtos selecionados definitivamente"
            >
              <Trash2 size={16} /> {bulkLoading ? 'Processando...' : `Excluir (${selectedIds.length})`}
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={bulkLoading}
              style={{
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.4)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Limpar Seleção
            </button>
          </div>
        </div>
      )}

      <div className="admin-table-container">
        {loading ? (
          <p style={{padding: 24, textAlign: 'center'}}>Carregando...</p>
        ) : (
          <table className="admin-table" style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>
                  <input 
                    type="checkbox"
                    checked={products.length > 0 && products.every(p => selectedIds.includes(p.id))}
                    onChange={handleSelectAllOnPage}
                    title="Selecionar todos desta página"
                    style={{ cursor: 'pointer', width: 17, height: 17, accentColor: '#185942' }}
                  />
                </th>
                <th onClick={() => handleSort('external_id')} style={{cursor: 'pointer'}}>
                  ID {sortField === 'external_id' && (sortOrder === 'asc' ? <ChevronUp size={14} style={{display: 'inline'}}/> : <ChevronDown size={14} style={{display: 'inline'}}/>)}
                </th>
                <th onClick={() => handleSort('photo')} style={{cursor: 'pointer', userSelect: 'none', minWidth: 100}} title="Ordenar por fotos (Sem foto primeiro / Com foto primeiro)">
                  Foto {sortField === 'photo' && (sortOrder === 'asc' ? <span style={{fontSize: '0.75rem', fontWeight: 600}}>(Sem foto 1º)</span> : <span style={{fontSize: '0.75rem', fontWeight: 600}}>(Com foto 1º)</span>)} {sortField === 'photo' && (sortOrder === 'asc' ? <ChevronUp size={14} style={{display: 'inline', verticalAlign: 'middle'}}/> : <ChevronDown size={14} style={{display: 'inline', verticalAlign: 'middle'}}/>)}
                </th>
                <th onClick={() => handleSort('name')} style={{cursor: 'pointer', userSelect: 'none'}} title="Ordenar alfabeticamente A-Z ou Z-A">
                  Produto {sortField === 'name' ? (sortOrder === 'asc' ? '(A-Z)' : '(Z-A)') : ''} {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14} style={{display: 'inline', verticalAlign: 'middle'}}/> : <ChevronDown size={14} style={{display: 'inline', verticalAlign: 'middle'}}/>)}
                </th>
                <th onClick={() => handleSort('categoryName')} style={{cursor: 'pointer'}}>
                  Categoria {sortField === 'categoryName' && (sortOrder === 'asc' ? <ChevronUp size={14} style={{display: 'inline'}}/> : <ChevronDown size={14} style={{display: 'inline'}}/>)}
                </th>
                <th onClick={() => handleSort('price')} style={{cursor: 'pointer'}}>
                  Preço {sortField === 'price' && (sortOrder === 'asc' ? <ChevronUp size={14} style={{display: 'inline'}}/> : <ChevronDown size={14} style={{display: 'inline'}}/>)}
                </th>
                <th onClick={() => handleSort('stock')} style={{cursor: 'pointer'}}>
                  Estoque {sortField === 'stock' && (sortOrder === 'asc' ? <ChevronUp size={14} style={{display: 'inline'}}/> : <ChevronDown size={14} style={{display: 'inline'}}/>)}
                </th>
                <th onClick={() => handleSort('active')} style={{cursor: 'pointer'}}>
                  Status {sortField === 'active' && (sortOrder === 'asc' ? <ChevronUp size={14} style={{display: 'inline'}}/> : <ChevronDown size={14} style={{display: 'inline'}}/>)}
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map(p => (
                <tr 
                  key={p.id}
                  onDragOver={(e) => onDragOver(e, p.id)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, p.id)}
                  style={{
                    backgroundColor: selectedIds.includes(p.id) ? '#f0fdf4' : (dragHoverId === p.id ? '#f0fdf4' : 'transparent'),
                    border: dragHoverId === p.id ? '2px dashed #22c55e' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => handleSelectOne(p.id)}
                      style={{ cursor: 'pointer', width: 17, height: 17, accentColor: '#185942' }}
                    />
                  </td>
                  <td>{p.external_id || p.id}</td>
                  <td>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} style={{width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb'}} />
                    ) : (
                      <div style={{width: 40, height: 40, backgroundColor: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af'}}>
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{fontWeight: 500, color: '#111827'}}>{p.name}</div>
                    {p.barcode && <div style={{fontSize: '0.75rem', color: '#6b7280'}}>EAN: {p.barcode}</div>}
                  </td>
                  <td>{p.categoryName || 'Sem Categoria'}</td>
                  <td>R$ {(p.price || 0).toFixed(2).replace('.',',')}</td>
                  <td>{p.stock || 0}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(p)}
                      title="Clique para alternar Ativo / Inativo"
                      style={{
                        backgroundColor: p.active ? '#dcfce7' : '#fee2e2', 
                        color: p.active ? '#166534' : '#991b1b', 
                        border: `1px solid ${p.active ? '#86efac' : '#fca5a5'}`,
                        padding: '3px 10px', 
                        borderRadius: 12, 
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: p.active ? '#16a34a' : '#dc2626'
                      }}></span>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td style={{display: 'flex', gap: 8, alignItems: 'center', height: '100%'}}>
                    <button 
                      className="btn-secondary" 
                      style={{padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, pointerEvents: dragHoverId === p.id ? 'none' : 'auto'}}
                      onClick={() => { setUploadingId(p.id); fileInputRef.current.click(); }}
                      disabled={uploadingId === p.id}
                    >
                      <UploadCloud size={16} />
                      {uploadingId === p.id ? 'Enviando...' : (dragHoverId === p.id ? 'Solte a foto' : (p.image_url ? 'Trocar' : '+ Adicionar'))}
                    </button>
                    {p.image_url && (
                      <button
                        style={{padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #f87171', borderRadius: '4px', cursor: 'pointer'}}
                        onClick={() => removePhoto(p.id)}
                        title="Remover foto"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {sortedProducts.length === 0 && (
                <tr>
                  <td colSpan="9" style={{textAlign: 'center', padding: 24, color: '#6b7280'}}>
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24, alignItems: 'center', paddingBottom: 24}}>
          <button 
            className="btn-secondary" 
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span>Página {page} de {totalPages}</span>
          <button 
            className="btn-secondary" 
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
