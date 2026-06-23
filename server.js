const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST') console.log('Body:', req.body);
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root health check
app.get('/', (req, res) => {
  res.json({
    app: 'Vyaapar Business Management API',
    status: '✅ Running',
    version: '1.0.0', // Backend latest version
    forceUpdate: false, // Set to true to force users to update
    apkUrl: 'https://wa.me/919999999999?text=Send%20me%20the%20latest%20app%20update', // Download link
    frontend: 'http://localhost:5173',
    endpoints: {
      auth: '/api/auth',
      customers: '/api/customers',
      products: '/api/products',
      invoices: '/api/invoices',
      payments: '/api/payments',
      expenses: '/api/expenses',
      dashboard: '/api/dashboard',
    },
    message: '👉 Open http://localhost:5173 in your browser to use the app.',
  });
});

// Version Check API
app.get('/api/version', (req, res) => {
  res.json({
    version: '1.0.0', // Backend latest version matches frontend, no popup shown
    forceUpdate: false, // Set to true to force users to update
    apkUrl: 'https://play.google.com/store/apps/details?id=com.bahikhata.app', // Play Store link
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/media', require('./routes/media'));
app.use('/api/notifications', require('./routes/notifications'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// Connect DB and start
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
