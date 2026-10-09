import React, { useState, useEffect, useRef } from 'react';
import { Search, Image as ImageIcon, UploadCloud, ChevronUp, ChevronDown, Upload, Trash2 } from 'lucide-react';
import { API_URL } from '../config/constants';

export default function ManagePhotos() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos'); 
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  
  const fileInputRef = useRef(null);
  const bulkInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  
  const [dragHoverId, setDragHoverId] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, [page]);

  const fetchProducts = async () => {
    setLoading(true);
    const token = localStorage.getItem('@BemEstar:adminToken');
    try {
      const res = await fetch(`${API_URL}/admin/products?search=${search}&page=${page}&limit=50&active=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.data || data);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchProducts();
    }, 400);
    return () => clearTimeout(delay);
  }, [search]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredProducts = products.filter(p => {
    if (filter === 'com') return p.image_url && p.image_url.trim() !== '';
    if (filter === 'sem') return !p.image_url || p.image_url.trim() === '';
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    
    // Numeric sort for Price and Stock
    if (sortField === 'price' || sortField === 'stock') {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    }
    
    // Boolean sort for active (Status)
    if (sortField === 'active') {
      valA = valA === 1 ? 1 : 0;
      valB = valB === 1 ? 1 : 0;
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    }

    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const uploadFile = async (file, productId) => {
    const token = localStorage.getItem('@BemEstar:adminToken');
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`${API_URL}/admin/products/${productId}/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: data.image_url } : p));
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  const removePhoto = async (productId) => {
    if (!window.confirm('Tem certeza que deseja remover a foto deste produto?')) return;
    
    const token = localStorage.getItem('@BemEstar:adminToken');
    try {
      const res = await fetch(`${API_URL}/admin/products/${productId}/image`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: null } : p));
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao remover foto.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao remover foto.');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingId) return;
    setUploadingId(uploadingId);
    await uploadFile(file, uploadingId);
    e.target.value = '';
    setUploadingId(null);
  };

  const handleBulkUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setBulkUploading(true);

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = file.name.split('.')[0]; 
      
      const product = products.find(p => p.external_id && p.external_id.toString() === filename);
      if (product) {
        const success = await uploadFile(file, product.id);
        if (success) successCount++;
      }
    }
    
    alert(`Processamento em lote concluído: ${successCount} imagem(ns) associada(s) com sucesso.`);
    setBulkUploading(false);
    e.target.value = '';
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
          {totalWithoutPhoto > 0 && (
            <div style={{color: '#d97706', backgroundColor: '#fef3c7', padding: '6px 12px', borderRadius: 16, fontSize: '0.85rem', fontWeight: 600}}>
              {totalWithoutPhoto} sem foto
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

      <div style={{display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap'}}>
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

        <div className="form-group" style={{margin: 0, width: 200}}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="todos">Mostrar: Todos</option>
            <option value="com">Somente com foto</option>
            <option value="sem">Somente sem foto</option>
          </select>
        </div>
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

      <div className="admin-table-container">
        {loading ? (
          <p style={{padding: 24, textAlign: 'center'}}>Carregando...</p>
        ) : (
          <table className="admin-table" style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr>
                <th onClick={() => handleSort('external_id')} style={{cursor: 'pointer'}}>
                  ID {sortField === 'external_id' && (sortOrder === 'asc' ? <ChevronUp size={14} style={{display: 'inline'}}/> : <ChevronDown size={14} style={{display: 'inline'}}/>)}
                </th>
                <th style={{width: 60}}>Foto</th>
                <th onClick={() => handleSort('name')} style={{cursor: 'pointer'}}>
                  Produto {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14} style={{display: 'inline'}}/> : <ChevronDown size={14} style={{display: 'inline'}}/>)}
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
                    backgroundColor: dragHoverId === p.id ? '#f0fdf4' : 'transparent',
                    border: dragHoverId === p.id ? '2px dashed #22c55e' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
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
                    <span style={{
                      backgroundColor: p.active ? '#dcfce7' : '#f3f4f6', 
                      color: p.active ? '#166534' : '#4b5563', 
                      padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem'
                    }}>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
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
                  <td colSpan="8" style={{textAlign: 'center', padding: 24, color: '#6b7280'}}>
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
