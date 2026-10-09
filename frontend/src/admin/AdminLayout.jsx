import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Package, Upload, FolderTree, Zap, Image as ImageIcon, Key } from 'lucide-react';
import './Admin.css';
import ChangePassword from './ChangePassword';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('@BemEstar:adminToken');
    navigate('/admin/login');
  };

  const onPasswordChanged = () => {
    alert('Senha alterada com sucesso! Por segurança, você será desconectado. Faça o login com sua nova senha.');
    handleLogout();
  };

  const menu = [
    { name: 'Produtos', path: '/admin', icon: Package },
    { name: 'Gerenciar Fotos', path: '/admin/photos', icon: ImageIcon },
    { name: 'Atualizar Estoque', path: '/admin/import', icon: Upload },
    { name: 'Categorias', path: '/admin/categories', icon: FolderTree },
    { name: 'Teste DotCompany', path: '/admin/dotcompany', icon: Zap },
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <h2>Bem Estar Admin</h2>
        </div>
        <nav className="admin-nav">
          {menu.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="admin-logout" style={{ background: 'transparent', color: 'var(--text-secondary)' }} onClick={() => setShowChangePassword(true)}>
            <Key size={20} />
            Alterar Senha
          </button>
          <button className="admin-logout" onClick={handleLogout}>
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>
      <main className="admin-content">
        <Outlet />
      </main>
      
      {showChangePassword && (
        <ChangePassword 
          onClose={() => setShowChangePassword(false)} 
          onPasswordChanged={onPasswordChanged} 
        />
      )}
    </div>
  );
}
