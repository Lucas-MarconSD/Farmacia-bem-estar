import React from 'react';
import { MapPin, Bike, Heart } from 'lucide-react';
import './AboutUs.css';

export default function AboutUs() {
  return (
    <section className="section about-section" id="quem-somos">
      <div className="container">
        <div className="about-content">
          <div className="about-text">
            <h2 className="section-title">Quem Somos</h2>
            <p>
              Na <strong>Farmácia Bem Star</strong>, nossa missão é cuidar de você e da sua família, oferecendo praticidade, atenção e produtos de qualidade para o dia a dia.
            </p>
            <p>
              Acreditamos que cuidar da saúde e do bem-estar deve ser simples e acessível. Por isso, buscamos proporcionar uma experiência de compra prática, com variedade de produtos, atendimento atencioso e a comodidade de receber suas compras em casa.
            </p>
            
            <div className="about-features">
              <div className="feature-item">
                <MapPin className="feature-icon" size={24} color="var(--color-primary)" />
                <span>Estamos em Belford Roxo, RJ, na Avenida Boulevard, nº 215, prontos para atender você.</span>
              </div>
              <div className="feature-item">
                <Bike className="feature-icon" size={24} color="var(--color-primary)" />
                <span>Fazemos entregas para levar mais comodidade até a sua porta.</span>
              </div>
              <div className="feature-item">
                <Heart className="feature-icon" size={24} color="var(--color-primary)" />
                <span>Farmácia Bem Star. Cuidando de você em cada detalhe!</span>
              </div>
            </div>
          </div>
          <div className="about-image-wrapper">
             <iframe 
               src="https://maps.google.com/maps?q=Av.%20Boulevard,%20215,%20Belford%20Roxo,%20RJ&t=&z=16&ie=UTF8&iwloc=&output=embed" 
               width="100%" 
               height="100%" 
               style={{ border: 0, minHeight: '400px', borderRadius: '16px' }} 
               allowFullScreen="" 
               loading="lazy" 
               referrerPolicy="no-referrer-when-downgrade"
               title="Localização da Farmácia Bem Star no Google Maps"
             ></iframe>
          </div>
        </div>
      </div>
    </section>
  );
}
