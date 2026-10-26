import React, { useState, useEffect } from 'react';
import { Edit2, Search, Trash2, Check, X, ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency';
import { supabase } from '../config/supabaseClient';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [editingProduct, setEditingProduct] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'inactive'
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const limit = 50;

  // Debounce na busca para evitar requisições concorrentes e atrasadas
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Converte campos da interface para colunas reais no banco de dados Supabase
  const getDbSortColumn = (field) => {
    switch (field) {
      case 'status':
      case 'active':
        return 'active';
      case 'category':
      case 'categoryName':
        return 'category_id';
      case 'price':
        return 'price';
      case 'stock':
        return 'stock';
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

    if (filterCategory) {
      query = query.eq('category_id', filterCategory);
    }

    if (filterStatus === 'active') {
      query = query.eq('active', true);
    } else if (filterStatus === 'inactive') {
      query = query.eq('active', false);
    }

    const dbSort = getDbSortColumn(sortField);
    query = query.order(dbSort, { ascending: sortOrder === 'asc', nullsFirst: false });

    // Ordenação secundária por nome para estabilidade da paginação
    if (dbSort !== 'name') {
      query = query.order('name', { ascending: true });
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
      console.error('Erro ao buscar produtos:', error);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (!error && data) setCategories(data);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
    setSelectedIds([]);
  }, [debouncedSearch, page, sortField, sortOrder, filterCategory, filterStatus]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1); // Sempre reinicia para a página 1 ao ordenar!
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

    // Atualização otimista
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

    // Atualização otimista
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

    // Atualização otimista
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
    // Atualização otimista na tela
    setProducts(prev => prev.map(item => item.id === p.id ? { ...item, active: nextStatus } : item));

    const { error } = await supabase
      .from('products')
      .update({ active: nextStatus })
      .eq('id', p.id);

    if (error) {
      console.error('Erro ao alternar status do produto:', error);
      alert('Não foi possível alterar o status: ' + error.message);
      fetchProducts();
    }
  };

  const SortIcon = ({ field }) => {
    const isCurrent = sortField === field || (field === 'status' && sortField === 'active') || (field === 'category' && sortField === 'category_id');
    if (!isCurrent) {
      return <span style={{ opacity: 0.35, marginLeft: 4, fontSize: '0.75rem' }}>⇅</span>;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp size={16} style={{ display: 'inline', verticalAlign: 'middle', color: '#185942' }} />
    ) : (
      <ChevronDown size={16} style={{ display: 'inline', verticalAlign: 'middle', color: '#185942' }} />
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...editingProduct,
      price: parseFloat(editingProduct.price) || 0,
      old_price: editingProduct.old_price ? parseFloat(editingProduct.old_price) : null,
      stock: parseInt(editingProduct.stock) || 0,
      category_id: editingProduct.category_id ? Number(editingProduct.category_id) : null,
      active: Boolean(editingProduct.active !== false && editingProduct.active !== 0 && editingProduct.active !== '0')
    };

    delete payload.categoryName; // Remove helper field
    delete payload.categories; // Remove helper field

    let finalImageUrl = payload.image_url;

    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const fileName = `product-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile, {
          upsert: true,
          contentType: imageFile.type || 'image/jpeg'
        });
      
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
        finalImageUrl = publicUrlData.publicUrl;
      } else {
        console.error('Erro no upload da foto:', uploadError);
        alert('Atenção: A foto não pôde ser salva no Storage (' + uploadError.message + '). Verifique as políticas de Storage (RLS) no Supabase.');
      }
    }
    
    payload.image_url = finalImageUrl;

    const { error } = await supabase.from('products').upsert(payload);

    if (!error) {
      setEditingProduct(null);
      setImageFile(null);
      fetchProducts();
    } else {
      alert('Erro ao salvar produto: ' + error.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja apagar o produto "${name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    const { error } = await supabase.from('products').delete().eq('id', id);

    if (!error) {
      fetchProducts();
    } else {
      alert('Erro ao apagar produto.');
    }
  };

  const openCreateForm = () => {
    setEditingProduct({
      name: '', external_id: '', barcode: '', brand: '', category_id: '', description: '', price: '', old_price: '', stock: '', active: true
    });
    setImageFile(null);
  };

  if (editingProduct) {
    return (
      <div className="admin-card">
        <div className="admin-header">
          <h1>{editingProduct.id ? 'Editar Produto' : 'Novo Produto'}</h1>
          <button className="btn-secondary" onClick={() => { setEditingProduct(null); setImageFile(null); }}>Voltar</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Foto do Produto</label>
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/webp"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  setImageFile(e.target.files[0]);
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setEditingProduct({...editingProduct, image_url: ev.target.result});
                  };
                  reader.readAsDataURL(e.target.files[0]);
                }
              }}
            />
            {editingProduct.image_url && (
              <img src={editingProduct.image_url} alt="Preview" style={{width: 100, marginTop: 10, borderRadius: 8, objectFit: 'cover'}} />
            )}
          </div>
          <div className="form-group">
            <label>Nome</label>
            <input 
              type="text" 
              value={editingProduct.name} 
              onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
              required
            />
          </div>
          <div style={{display: 'flex', gap: 16, flexWrap: 'wrap'}}>
            <div className="form-group" style={{flex: 1}}>
              <label>EAN (Código de Barras)</label>
              <input 
                type="text" 
                value={editingProduct.barcode || ''} 
                onChange={e => setEditingProduct({...editingProduct, barcode: e.target.value})}
              />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Código Externo</label>
              <input 
                type="text" 
                value={editingProduct.external_id || ''} 
                onChange={e => setEditingProduct({...editingProduct, external_id: e.target.value})}
              />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Marca / Laboratório</label>
              <input 
                type="text" 
                value={editingProduct.brand || ''} 
                onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Categoria</label>
            <select 
              value={editingProduct.category_id || ''} 
              onChange={e => setEditingProduct({...editingProduct, category_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Descrição Personalizada</label>
            <textarea 
              value={editingProduct.description || ''} 
              onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
              rows="3"
            />
          </div>
          <div style={{display: 'flex', gap: 16, flexWrap: 'wrap'}}>
            <div className="form-group" style={{flex: 1}}>
              <label>Preço (R$)</label>
              <input 
                type="number" 
                step="0.01" 
                value={editingProduct.price} 
                onChange={e => setEditingProduct({...editingProduct, price: e.target.value})}
                required
              />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Preço Antigo (R$)</label>
              <input 
                type="number" 
                step="0.01" 
                value={editingProduct.old_price || ''} 
                onChange={e => setEditingProduct({...editingProduct, old_price: e.target.value})}
              />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Estoque</label>
              <input 
                type="number" 
                value={editingProduct.stock} 
                onChange={e => setEditingProduct({...editingProduct, stock: e.target.value})}
                required
              />
            </div>
          </div>
          
          <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <input 
              type="checkbox" 
              id="active"
              checked={Boolean(editingProduct.active !== false && editingProduct.active !== 0 && editingProduct.active !== '0')}
              onChange={e => setEditingProduct({...editingProduct, active: e.target.checked})}
              style={{width: 'auto'}}
            />
            <label htmlFor="active" style={{margin: 0}}>Exibir no catálogo público</label>
          </div>
          
          <div style={{display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap'}}>
            <button type="submit" className="btn-primary">Salvar Produto</button>
            <button type="button" className="btn-secondary" onClick={() => setEditingProduct(null)}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-card">
      <div className="admin-header">
        <h1>Produtos Cadastrados</h1>
        <button className="btn-primary" onClick={openCreateForm}>Novo Produto</button>
      </div>
      
      <div className="admin-search-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Buscar por nome, código ou código de barras..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <select 
          value={filterCategory} 
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="admin-select"
          style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', fontSize: '0.9rem' }}
        >
          <option value="">Todas as Categorias</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select 
          value={filterStatus} 
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="admin-select"
          style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', fontSize: '0.9rem' }}
        >
          <option value="all">Status: Todos</option>
          <option value="active">Somente Ativos (Visíveis)</option>
          <option value="inactive">Somente Desativados (Ocultos)</option>
        </select>

        {(search || filterCategory || filterStatus !== 'all') && (
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => {
              setSearch('');
              setDebouncedSearch('');
              setFilterCategory('');
              setFilterStatus('all');
              setPage(1);
            }}
            style={{ padding: '10px 14px', fontSize: '0.85rem' }}
            title="Limpar todos os filtros"
          >
            Limpar Filtros
          </button>
        )}

        <div style={{ fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
          <strong>{totalCount}</strong> produtos encontrados
        </div>
      </div>

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

      <div style={{overflowX: 'auto', width: '100%'}}>
        <table className="admin-table">
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
              <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('id')}>
                ID <SortIcon field="id" />
              </th>
              <th>Foto</th>
              <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('name')}>
                Produto {sortField === 'name' ? (sortOrder === 'asc' ? '(A-Z)' : '(Z-A)') : ''} <SortIcon field="name" />
              </th>
              <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('category')}>
                Categoria <SortIcon field="category" />
              </th>
              <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('price')}>
                Preço <SortIcon field="price" />
              </th>
              <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('stock')}>
                Estoque <SortIcon field="stock" />
              </th>
              <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('active')}>
                Status {sortField === 'active' ? (sortOrder === 'desc' ? '(Ativos 1º)' : '(Inativos 1º)') : ''} <SortIcon field="active" />
              </th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
          {loading ? (
            <tr>
              <td colSpan="9" style={{textAlign: 'center', padding: '32px', color: '#6b7280'}}>Carregando produtos...</td>
            </tr>
          ) : products && products.length > 0 ? (
            products.map(p => (
              <tr key={p.id} style={{ backgroundColor: selectedIds.includes(p.id) ? '#f0fdf4' : undefined }}>
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
                    <img src={p.image_url} alt={p.name} className="product-img-mini" />
                  ) : (
                    <div className="product-img-mini" />
                  )}
                </td>
                <td>
                  <strong>{p.name}</strong>
                  <div style={{fontSize: '0.75rem', color: '#6b7280'}}>EAN: {p.barcode || '-'}</div>
                </td>
                <td>{p.categoryName || 'Sem categoria'}</td>
                <td>R$ {formatCurrency(p.price)}</td>
                <td>{p.stock}</td>
                <td>
                  <button 
                    type="button"
                    onClick={() => handleToggleActive(p)}
                    className={`status-badge ${p.active ? 'status-active' : 'status-inactive'}`}
                    style={{ 
                      cursor: 'pointer', 
                      border: 'none', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 4, 
                      fontWeight: 600,
                      padding: '4px 10px',
                      transition: 'all 0.2s ease'
                    }}
                    title="Clique para alternar entre Ativo e Inativo"
                  >
                    {p.active ? <Check size={12} /> : <X size={12} />}
                    {p.active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td>
                  <div style={{display: 'flex', gap: 8}}>
                    <button 
                      className="btn-secondary" 
                      style={{padding: '6px 10px'}}
                      onClick={() => setEditingProduct(p)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      className="btn-secondary" 
                      style={{padding: '6px 10px', color: 'var(--color-accent)'}}
                      onClick={() => handleDelete(p.id, p.name)}
                      title="Apagar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="9" style={{textAlign: 'center', padding: '24px'}}>Nenhum produto encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      
      {totalPages > 1 && (
        <div style={{display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24, alignItems: 'center'}}>
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
