const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env'); // Loads dotenv and verifies environment

// DB Initialization
const db = require('./database/sqlite');
const UserRepository = require('./repositories/UserRepository');
const { hashPassword } = require('./security/password');

const setupAdmin = () => {
  const admin = UserRepository.findByUsername('admin');
  if (!admin) {
    const initialPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!initialPassword) {
      console.error("ERRO DE SEGURANÇA: Usuário administrador não encontrado no banco de dados e a variável 'DEFAULT_ADMIN_PASSWORD' não foi configurada. O sistema não pode inicializar sem uma senha forte definida.");
      process.exit(1);
    }
    UserRepository.create('admin', hashPassword(initialPassword), 'admin');
    console.log("Usuário administrador (admin) criado com sucesso.");
  }
};
setupAdmin();

const app = express();

// Global Middlewares
const corsOptions = {
  origin: env.FRONTEND_URL,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Uploads (Servindo a pasta correta definida pela variável de ambiente)
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api', authRoutes); // Includes /api/login
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(env.PORT, () => {
  console.log(`Servidor backend rodando na porta ${env.PORT}`);
});
