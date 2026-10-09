import React from 'react';
import { Truck, ShieldCheck, HeartHandshake } from 'lucide-react';
import './Benefits.css';

export default function Benefits() {
  const benefits = [
    {
      icon: Truck,
      title: 'Entrega rápida',
      description: 'Receba com conforto e segurança.'
    },
    {
      icon: ShieldCheck,
      title: 'Compra protegida',
      description: 'Seus dados sempre seguros.'
    },
    {
      icon: HeartHandshake,
      title: 'Cuidado de verdade',
      description: 'Atendimento humano e próximo.'
    }
  ];

  return (
    <section className="section benefits-section">
      <div className="container">
        <div className="benefits-grid">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div key={index} className="benefit-card">
                <div className="benefit-icon-wrapper">
                  <Icon size={32} />
                </div>
                <h3 className="benefit-title">{benefit.title}</h3>
                <p className="benefit-desc">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
