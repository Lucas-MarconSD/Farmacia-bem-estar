import React from 'react';

const CustomLogo = ({ width = 200, height = 90 }) => (
  <svg width={width} height={height} viewBox="0 0 200 115" xmlns="http://www.w3.org/2000/svg" className="header-custom-logo">
    <defs>
      <style>
        {`
          .logo-text-white { 
            fill: #ffffff; 
            font-family: 'Arial Black', Impact, sans-serif; 
            font-weight: 900; 
            letter-spacing: -1px;
          }
          .logo-text-green { 
            fill: #00d26a; 
            font-family: 'Arial', sans-serif; 
            font-weight: 700; 
            letter-spacing: 2px; 
          }
          .floating-plus { 
            animation: floatPlus 3s ease-in-out infinite; 
            transform-origin: 135px 50px;
          }
          @keyframes floatPlus {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-8px) rotate(5deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
        `}
      </style>
    </defs>

    <text x="5" y="60" fontSize="56" className="logo-text-white">Bem</text>
    <text x="95" y="105" fontSize="56" className="logo-text-white">star</text>

    <g className="floating-plus">
      <path d="M 140 25 h 12 v 12 h 12 v 12 h -12 v 12 h -12 v -12 h -12 v -12 h 12 z" fill="#00d26a" stroke="#ffffff" strokeWidth="3" />
    </g>
  </svg>
);

export default CustomLogo;
