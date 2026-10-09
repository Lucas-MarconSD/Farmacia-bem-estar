import React, { useState } from 'react';
import { Search, ShoppingCart, Heart, User, Leaf, Menu } from 'lucide-react';
import './Header.css';

import CustomLogo from './CustomLogo';

function SearchBar({ searchTerm, setSearchTerm, className, style }) {
  return (
    <div className={className} style={style}>
      <input
        type="text"
        placeholder="O que você está procurando?"
        className="search-input"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Buscar produtos"
      />
      <button className="search-button" aria-label="Executar busca">
        <Search size={20} />
      </button>
    </div>
  );
}

export default function Header({ cartCount, onOpenCart, searchTerm, setSearchTerm, setActiveCategory }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMenu = () => setIsMobileMenuOpen(false);

  const handleNavClick = (e, category) => {
    e.preventDefault();
    if (setActiveCategory) setActiveCategory(category);
    closeMenu();
    // Scroll to catalog smoothly
    const catalog = document.getElementById('ofertas');
    if (catalog) catalog.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="header">
      <div className="top-bar">
        Entrega rápida e segura para toda a cidade
      </div>

      <div className="header-main">
        <div className="flex items-center gap-4">
          <button
            className="action-btn mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Alternar menu mobile"
            aria-expanded={isMobileMenuOpen}
          >
            <Menu size={24} />
          </button>
          <a href="/" className="logo" aria-label="Farmácia Bem Star - Página Inicial" style={{ textDecoration: 'none' }}>
            <CustomLogo />
          </a>
        </div>

        <SearchBar
          className="search-bar"
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />

        <div className="header-actions">
          <button className="action-btn hidden-mobile" aria-label="Acessar conta" onClick={() => window.location.href = '/admin'}>
            <User size={24} />
            <span>Acesso</span>
          </button>
          <button className="action-btn" aria-label="Meus favoritos">
            <Heart size={24} />
            <span className="hidden-mobile">Favoritos</span>
          </button>
          <button className="action-btn" onClick={onOpenCart} aria-label="Abrir carrinho">
            <div style={{ position: 'relative' }}>
              <ShoppingCart size={24} />
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </div>
            <span className="hidden-mobile">Carrinho</span>
          </button>
        </div>
      </div>

      <div className="mobile-search">
        <SearchBar
          className="mobile-search-inner"
          style={{ position: 'relative' }}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      </div>

      <nav className={`header-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <ul className="nav-list">
          <li><a href="#" className="nav-item" onClick={(e) => handleNavClick(e, 'todos')}>Início</a></li>
          <li><a href="#medicamentos" className="nav-item" onClick={(e) => handleNavClick(e, 'medicamentos')}>Medicamentos</a></li>
          <li><a href="#saude" className="nav-item" onClick={(e) => handleNavClick(e, 'saude-e-bem-estar')}>Saúde e Bem-Estar</a></li>
          <li><a href="#beleza" className="nav-item" onClick={(e) => handleNavClick(e, 'beleza-e-perfumaria')}>Beleza e Perfumaria</a></li>
          <li><a href="#bebe" className="nav-item" onClick={(e) => handleNavClick(e, 'mamae-e-bebe')}>Mamãe e Bebê</a></li>
          <li><a href="#higiene" className="nav-item" onClick={(e) => handleNavClick(e, 'higiene-e-cuidados-pessoais')}>Higiene Pessoal</a></li>
          <li><a href="#ofertas" className="nav-item highlight" onClick={(e) => handleNavClick(e, 'todos')}>Ofertas</a></li>
        </ul>
      </nav>
    </header>
  );
}
