import React, { useState } from 'react';
import Header from './components/Header';
import Banner from './components/Banner';
import Catalog from './components/Catalog';
import AboutUs from './components/AboutUs';
import Benefits from './components/Benefits';
import Footer from './components/Footer';
import Cart from './components/Cart';
import { useCart } from './hooks/useCart';

export default function Storefront() {
  const cart = useCart();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('todos');

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  return (
    <div className="app-container">
      <Header 
        cartCount={cart.cartCount} 
        onOpenCart={cart.openCart} 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        setActiveCategory={setActiveCategory}
      />
      
      <main>
        <Banner />
        <Catalog 
          onAddToCart={cart.addToCart} 
          searchTerm={searchTerm}
          onClearSearch={handleClearSearch}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
        />
        <AboutUs />
        <Benefits />
      </main>

      <Footer />

      <Cart 
        isOpen={cart.isCartOpen}
        onClose={cart.closeCart}
        cartItems={cart.cartItems}
        onUpdateQuantity={cart.updateQuantity}
        onRemoveItem={cart.removeItem}
      />
    </div>
  );
}
