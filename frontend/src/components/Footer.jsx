import React from 'react';
import { MessageCircle } from 'lucide-react';
import CustomLogo from './CustomLogo';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="footer-logo">
              <CustomLogo width="160" height="72" />
            </div>
            <p className="footer-desc">
              Saúde, cuidado e bem-estar mais perto de você, todos os dias.
            </p>
          </div>

          <div>
            <h4 className="footer-title">Links Úteis</h4>
            <ul className="footer-links">
              <li><a href="#quem-somos" className="footer-link" onClick={(e) => { e.preventDefault(); document.getElementById('quem-somos')?.scrollIntoView({ behavior: 'smooth' }); }}>Quem somos</a></li>
              <li><a href="#" className="footer-link">Nossas lojas</a></li>
              <li><a href="#" className="footer-link">Fale conosco</a></li>
              <li><a href="#" className="footer-link">Trabalhe conosco</a></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-title">Atendimento</h4>
            <ul className="footer-links">
              <li><a href="#" className="footer-link">Como comprar</a></li>
              <li><a href="#" className="footer-link">Entregas</a></li>
              <li><a href="#" className="footer-link">Trocas e devoluções</a></li>
              <li><a href="#" className="footer-link">Política de privacidade</a></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-title">Contato e Endereço</h4>
            <ul className="footer-links">
              <li><span className="footer-link">Av. Boulevard, 215, Belford Roxo, RJ</span></li>
              <li><span className="footer-link">Seg a Sáb, das 9h às 23h</span></li>
              <li><a href="https://wa.me/5521996288008" target="_blank" rel="noopener noreferrer" className="footer-link">WhatsApp: (21) 99628-8008</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2025 Farmácia Bem Estar. Todos os direitos reservados.</p>
          <button className="whatsapp-btn" onClick={() => window.open('https://wa.me/5521996288008', '_blank')}>
            <MessageCircle size={20} />
            Conversar no WhatsApp
          </button>
        </div>
      </div>
    </footer>
  );
}
