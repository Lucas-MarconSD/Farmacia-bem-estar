import React, { useState, useEffect } from 'react';
import { Heart, Plus, SearchX } from 'lucide-react';
import { ProductService } from '../services/ProductService';
import { formatCurrency } from '../utils/formatCurrency';
import CustomLogo from './CustomLogo';
import './Catalog.css';

export default function Catalog({ onAddToCart, searchTerm, onClearSearch, activeCategory = 'todos', setActiveCategory }) {
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('@BemEstar:favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [filters, setFilters] = useState([{ id: 'todos', label: 'Todos' }]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fallback setter se não for passado do Storefront
  const setCategory = setActiveCategory || (() => {});

  useEffect(() => {
    ProductService.getCategories().then(cats => {
      const dynamicFilters = cats
        .filter(c => c.name !== 'Assistencia Farmaceutica' && c.name !== 'Assistência Farmacêutica')
        .map(c => ({ id: c.id, label: c.name }));
      setFilters([{ id: 'todos', label: 'Todos' }, ...dynamicFilters]);
    });
  }, []);

  useEffect(() => {
    let isActive = true;
    setCurrentPage(1);
    setIsLoading(true);
    ProductService.filterProducts(searchTerm, activeCategory, 1, 20).then(result => {
      if (isActive) {
        setFilteredProducts(result.data || []);
        setTotalProducts(result.total || 0);
        setIsLoading(false);
      }
    });
    return () => {
      isActive = false;
    };
  }, [searchTerm, activeCategory]);

  const toggleFavorite = (productId) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(productId)) {
      newFavorites.delete(productId);
    } else {
      newFavorites.add(productId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('@BemEstar:favorites', JSON.stringify(Array.from(newFavorites)));
  };

  const handleLoadMore = () => {
    if (isLoading) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    setIsLoading(true);
    ProductService.filterProducts(searchTerm, activeCategory, nextPage, 20).then(result => {
      setFilteredProducts(prev => [...prev, ...(result.data || [])]);
      setIsLoading(false);
    });
  };

  const displayedProducts = filteredProducts;

  return (
    <section id="ofertas" className="section catalog-section">
      <div className="container">
        <div className="catalog-header">
          <div>
            <p className="section-subtitle">Preços especiais</p>
            <h2 className="section-title">Ofertas para cuidar de você</h2>
          </div>
          
          <div 
            className="filters-wrapper no-scrollbar"
            onMouseDown={(e) => {
              const slider = e.currentTarget;
              let isDown = true;
              let startX = e.pageX - slider.offsetLeft;
              let scrollLeft = slider.scrollLeft;
              
              const onMouseMove = (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - slider.offsetLeft;
                const walk = (x - startX) * 2;
                slider.scrollLeft = scrollLeft - walk;
              };
              
              const onMouseUp = () => {
                isDown = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
              };
              
              window.addEventListener('mousemove', onMouseMove);
              window.addEventListener('mouseup', onMouseUp);
            }}
          >
            {filters.map(filter => (
              <button
                key={filter.id}
                className={`filter-btn ${activeCategory === filter.id ? 'active' : ''}`}
                onClick={() => setCategory(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {displayedProducts.length > 0 ? (
          <div className="products-grid">
            {displayedProducts.map(product => (
              <div key={product.id} className="product-card">
                {product.discount && (
                  <div className="product-badge">OFERTA</div>
                )}
                
                <button 
                  className={`product-fav-btn ${favorites.has(product.id) ? 'active' : ''}`}
                  onClick={() => toggleFavorite(product.id)}
                  aria-label={favorites.has(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <Heart size={20} fill={favorites.has(product.id) ? 'currentColor' : 'none'} />
                </button>

                <div className="product-image-wrapper">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
                  ) : (
                    <div 
                      className="product-image-fallback" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        backgroundColor: 'var(--color-primary)',
                        padding: '1rem',
                        aspectRatio: '1 / 1'
                      }}
                    >
                      <CustomLogo width="80%" height="auto" />
                    </div>
                  )}
                </div>

                <div className="product-category">{product.categoryName}</div>
                <h3 className="product-name">{product.name}</h3>
                <p className="product-desc">{product.description}</p>

                <div className="product-footer">
                  <div className="product-prices">
                    {product.oldPrice && (
                      <span className="price-old">R$ {formatCurrency(product.oldPrice)}</span>
                    )}
                    <span className="price-current">R$ {formatCurrency(product.price)}</span>
                  </div>
                  <button 
                    className="add-to-cart-btn"
                    onClick={() => onAddToCart(product)}
                    aria-label="Adicionar ao carrinho"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <SearchX size={48} className="empty-state-icon" />
            <h3 className="empty-state-text">Nenhum produto encontrado.</h3>
            <button className="btn-secondary" onClick={onClearSearch}>
              Limpar busca
            </button>
          </div>
        )}

        {filteredProducts.length < totalProducts && (
          <div className="catalog-actions">
            <button className="btn-primary" onClick={handleLoadMore} disabled={isLoading}>
              {isLoading ? 'Carregando...' : 'Ver mais produtos'}
            </button>
            <p className="catalog-info">Mostrando {filteredProducts.length} de {totalProducts} itens disponíveis</p>
          </div>
        )}
      </div>
    </section>
  );
}
