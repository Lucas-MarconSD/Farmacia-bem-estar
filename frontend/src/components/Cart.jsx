import React, { useMemo } from 'react';
import { X, ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency';
import { WHATSAPP_NUMBER } from '../config/constants';
import './Cart.css';

export default function Cart({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem }) {

  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cartItems]);

  const total = subtotal; // For now, no shipping or extra fees

  const handleCheckout = () => {
    if (cartItems.length === 0) return;

    let message = "Olá, Farmácia Bem Star! Gostaria de finalizar meu pedido:\n\n";
    
    cartItems.forEach(item => {
      message += `${item.quantity}x ${item.name} - R$ ${formatCurrency(item.price)}\n`;
    });
    
    message += `\n*Total do pedido: R$ ${formatCurrency(total)}*`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className={`cart-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="cart-sidebar" onClick={e => e.stopPropagation()}>
        <div className="cart-header">
          <h2 className="cart-title">
            Carrinho <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>({cartItems.length})</span>
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Fechar carrinho">
            <X size={24} />
          </button>
        </div>

        <div className="cart-body">
          {cartItems.length === 0 ? (
            <div className="cart-empty">
              <ShoppingBag size={64} className="cart-empty-icon" strokeWidth={1} />
              <h3 className="cart-empty-title">Seu carrinho está vazio</h3>
              <p>Adicione produtos para começar seu pedido.</p>
              <button className="cart-empty-btn" onClick={onClose}>
                Explorar produtos
              </button>
            </div>
          ) : (
            <div className="cart-items">
              {cartItems.map(item => (
                <div key={item.id} className="cart-item">
                  <img src={item.image} alt={item.name} className="cart-item-image" />
                  <div className="cart-item-info">
                    <h4 className="cart-item-name">{item.name}</h4>
                    <span className="cart-item-price">R$ {formatCurrency(item.price)}</span>
                    
                    <div className="cart-item-actions">
                      <div className="quantity-control">
                        <button 
                          className="qty-btn"
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          aria-label="Diminuir quantidade"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="qty-value">{item.quantity}</span>
                        <button 
                          className="qty-btn"
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          aria-label="Aumentar quantidade"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      
                      <button 
                        className="remove-btn"
                        onClick={() => onRemoveItem(item.id)}
                        aria-label={`Remover ${item.name} do carrinho`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-summary">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>R$ {formatCurrency(subtotal)}</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>R$ {formatCurrency(total)}</span>
              </div>
            </div>
            
            <button className="checkout-btn" onClick={handleCheckout}>
              Finalizar pelo WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
