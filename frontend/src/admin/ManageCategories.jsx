import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, FolderTree, RefreshCw } from 'lucide-react';
import { supabase } from '../config/supabaseClient';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function ManageCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (catError) throw catError;
      setCategories(data || []);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
      setError('Erro ao carregar categorias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setActive(true);
    setError('');
    setSuccess('');
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setActive(cat.active !== false);
    setError('');
    setSuccess('');
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!editingCategory) {
      setSlug(slugify(val));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Nome da categoria é obrigatório.');
    if (!slug.trim()) return setError('Slug é obrigatório.');

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: name.trim(),
        slug: slugify(slug),
        active: Boolean(active)
      };

      if (editingCategory) {
        payload.id = editingCategory.id;
      }

      const { error: saveError } = await supabase.from('categories').upsert(payload);

      if (saveError) throw saveError;

      setSuccess(editingCategory ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!');
      setEditingCategory(null);
      setName('');
      setSlug('');
      fetchCategories();
    } catch (err) {
      console.error('Erro ao salvar categoria:', err);
      setError('Erro ao salvar categoria: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, catName) => {
    if (!window.confirm(`Tem certeza que deseja apagar a categoria "${catName}"?`)) return;

    try {
      const { error: delError } = await supabase.from('categories').delete().eq('id', id);
      if (delError) throw delError;
      setSuccess(`Categoria "${catName}" removida com sucesso!`);
      fetchCategories();
    } catch (err) {
      console.error('Erro ao deletar categoria:', err);
      setError('Erro ao excluir categoria: ' + err.message);
    }
  };

  const toggleStatus = async (cat) => {
    try {
      const { error: updError } = await supabase
        .from('categories')
        .update({ active: !cat.active })
        .eq('id', cat.id);

      if (updError) throw updError;
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, active: !c.active } : c));
    } catch (err) {
      console.error('Erro ao alterar status da categoria:', err);
      setError('Erro ao alterar status: ' + err.message);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FolderTree size={28} color="var(--color-primary, #185942)" />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Gerenciador de Categorias</h1>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
              Gerencie as categorias exibidas no menu e nos filtros da vitrine.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={fetchCategories} title="Atualizar">
            <RefreshCw size={18} />
          </button>
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={18} /> Nova Categoria
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ background: '#def7ec', color: '#03543f', padding: 12, borderRadius: 8, marginBottom: 16 }}>{success}</div>}

      {(name !== '' || editingCategory !== null) && (
        <div style={{ background: '#f3f4f6', padding: 20, borderRadius: 8, marginBottom: 24, border: '1px solid #e5e7eb' }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>
            {editingCategory ? `Editar Categoria: ${editingCategory.name}` : 'Criar Nova Categoria'}
          </h3>
          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 1, minWidth: 200, margin: 0 }}>
                <label>Nome da Categoria</label>
                <input
                  type="text"
                  placeholder="Ex: Dermocosméticos"
                  value={name}
                  onChange={handleNameChange}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 200, margin: 0 }}>
                <label>Slug (Identificador URL)</label>
                <input
                  type="text"
                  placeholder="dermocosmeticos"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input
                type="checkbox"
                id="cat-active"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <label htmlFor="cat-active" style={{ margin: 0, cursor: 'pointer' }}>
                Categoria Ativa (visível na vitrine)
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar Categoria'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setEditingCategory(null); setName(''); setSlug(''); }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280' }}>
          Carregando categorias...
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Slug</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.length > 0 ? (
                categories.map(cat => (
                  <tr key={cat.id}>
                    <td><span style={{ color: '#6b7280', fontSize: '0.85rem' }}>#{cat.id}</span></td>
                    <td><strong>{cat.name}</strong></td>
                    <td><code>{cat.slug}</code></td>
                    <td>
                      <button
                        onClick={() => toggleStatus(cat)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title="Clique para alternar o status"
                      >
                        <span className={`status-badge ${cat.active ? 'status-active' : 'status-inactive'}`}>
                          {cat.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 10px' }}
                          onClick={() => openEditModal(cat)}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 10px', color: '#EF725D' }}
                          onClick={() => handleDelete(cat.id, cat.name)}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
