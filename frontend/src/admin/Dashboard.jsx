import React, { useState, useEffect } from 'react';
import { Edit2, Search, Trash2, Check, X, ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency';
import { supabase } from '../config/supabaseClient';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingProduct, setEditingProduct] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterCategory, setFilterCategory] = useState('');
  const limit = 50;

  const fetchProducts = async () => {
    let query = supabase.from('products').select('*, categories(name)', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%,external_id.ilike.%${search}%`);
    }

    if (filterCategory) {
      query = query.eq('category_id', filterCategory);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order(sortField, { ascending: sortOrder === 'asc' }).range(from, to);

    const { data, count, error } = await query;

    if (!error) {
      const mapped = data.map(p => ({
        ...p,
        categoryName: p.categories?.name
      }));
      setProducts(mapped);
      setTotalPages(Math.ceil((count || 0) / limit) || 1);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (!error) setCategories(data);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [search, page, sortField, sortOrder, filterCategory]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1); // Reset to page 1 on new search
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...editingProduct,
      price: parseFloat(editingProduct.price) || 0,
      old_price: editingProduct.old_price ? parseFloat(editingProduct.old_price) : null,
      stock: parseInt(editingProduct.stock) || 0,
      category_id: editingProduct.category_id || null
    };

    delete payload.categoryName; // Remove helper field
    delete payload.categories; // Remove helper field

    let finalImageUrl = payload.image_url;

    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const fileName = `product-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile);
      
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
        finalImageUrl = publicUrlData.publicUrl;
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
      name: '', external_id: '', barcode: '', brand: '', category_id: '', description: '', price: '', old_price: '', stock: '', active: 1
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
              checked={editingProduct.active === 1}
              onChange={e => setEditingProduct({...editingProduct, active: e.target.checked ? 1 : 0})}
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
      
      <div className="admin-search-bar">
        <input 
          type="text" 
          placeholder="Buscar por nome, código ou código de barras..." 
          value={search}
          onChange={handleSearchChange}
        />
        <select 
          value={filterCategory} 
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="admin-select"
          style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: '#fff' }}
        >
          <option value="">Todas as Categorias</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn-secondary"><Search size={20} /></button>
      </div>

      <div style={{overflowX: 'auto', width: '100%'}}>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{cursor: 'pointer'}} onClick={() => handleSort('id')}>ID <SortIcon field="id" /></th>
              <th>Foto</th>
              <th style={{cursor: 'pointer'}} onClick={() => handleSort('name')}>Produto <SortIcon field="name" /></th>
              <th style={{cursor: 'pointer'}} onClick={() => handleSort('category')}>Categoria <SortIcon field="category" /></th>
              <th style={{cursor: 'pointer'}} onClick={() => handleSort('price')}>Preço <SortIcon field="price" /></th>
              <th style={{cursor: 'pointer'}} onClick={() => handleSort('stock')}>Estoque <SortIcon field="stock" /></th>
              <th style={{cursor: 'pointer'}} onClick={() => handleSort('status')}>Status <SortIcon field="status" /></th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
          {products && products.length > 0 ? (
            products.map(p => (
              <tr key={p.id}>
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
                  <span className={`status-badge ${p.active ? 'status-active' : 'status-inactive'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
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
              <td colSpan="8" style={{textAlign: 'center', padding: '24px'}}>Nenhum produto encontrado.</td>
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
