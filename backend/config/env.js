require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY;

if (!SECRET_KEY) {
  console.error("ERRO CRÍTICO: SECRET_KEY não configurada no .env. Encerrando o servidor.");
  process.exit(1);
}

module.exports = {
  PORT: process.env.PORT || 3001,
  SECRET_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',
  DOTCOMPANY_API_KEY: process.env.DOTCOMPANY_API_KEY,
  DOTCOMPANY_ENABLED: process.env.DOTCOMPANY_ENABLED === 'true'
};
