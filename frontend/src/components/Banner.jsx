import React from 'react';
import { ShieldCheck, HeartHandshake, Leaf, Sparkles } from 'lucide-react';
import './Banner.css';

export default function Banner() {
  return (
    <section className="banner">
      <div className="bg-shape-1"></div>
      <div className="bg-shape-2"></div>
      
      <div className="banner-container container">
        <div className="banner-content">
          <div className="banner-badge">
            <Sparkles size={16} />
            <span>Cuidado em cada detalhe</span>
          </div>
          <h1 className="banner-title">Bem-estar que cabe na sua rotina.</h1>
          <p className="banner-desc">
            Tudo para cuidar de você e da sua família, com orientação, confiança e aquele atendimento próximo de sempre.
          </p>
          <a href="#ofertas" className="banner-btn">Ver ofertas</a>
        </div>

        <div className="banner-visual hidden-mobile">
          <div className="visual-circle-1"></div>
          <div className="visual-circle-2"></div>
          
          <div className="visual-icon">
            <Leaf size={80} />
          </div>

          <div className="floating-card card-1">
            <div className="card-icon">
              <ShieldCheck size={18} />
            </div>
            <span>Compra segura — Do pedido à entrega</span>
          </div>

          <div className="floating-card card-2">
            <div className="card-icon">
              <HeartHandshake size={18} />
            </div>
            <span>Cuidado próximo — Conte com a gente</span>
          </div>
        </div>
      </div>
    </section>
  );
}
