const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const authRoutes = require('../routes/auth');
const productRoutes = require('../routes/products');
const invoiceRoutes = require('../routes/invoices');
const customerRoutes = require('../routes/customers');

const User = require('../models/User');

let app;
let authToken;
let userId;

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/vyaapar_test_products');
  await mongoose.connection.db.dropDatabase();

  app = express();
  app.use(express.json());
  
  app.use((req, res, next) => {
    if (authToken) req.headers.authorization = `Bearer ${authToken}`;
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/customers', customerRoutes);

  const user = await User.create({
    name: 'Test User', email: 'testprod@test.com', password: 'password123',
    businessName: 'Test Business', phone: '9999999999', pin: '1234',
    subscription: { status: 'active', validUntil: new Date(Date.now() + 1000000000) }
  });
  userId = user._id;
  authToken = jwt.sign({ id: user._id }, 'test_secret', { expiresIn: '1h' });
  process.env.JWT_SECRET = 'test_secret';
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

describe('Product Inventory Logic', () => {
  let productId;
  let customerId;

  beforeAll(async () => {
    // Create a dummy customer for invoices
    const res = await request(app).post('/api/customers').send({ name: 'Test Customer', openingBalance: 0, balanceType: 'receivable' });
    customerId = res.body._id;
  });

  it('1. Create a Product with Initial Stock', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Test Item', SKU: 'ITEM-01', sellingPrice: 100, purchasePrice: 50, stockQty: 50, minStock: 10 });
    expect(res.status).toBe(201);
    expect(res.body.stockQty).toBe(50);
    productId = res.body._id;
  });

  it('2. Sell Product via Sales Invoice (Stock Decreases)', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send({
        customer: customerId, type: 'sale', invoiceDate: new Date(),
        items: [{ product: productId, name: 'Test Item', quantity: 5, rate: 100, totalAmount: 500 }],
        subtotal: 500, finalAmount: 500
      });
    expect(res.status).toBe(201);
    
    const prodRes = await request(app).get(`/api/products/${productId}`);
    expect(prodRes.body.stockQty).toBe(45); // 50 - 5 = 45
  });

  it('3. Purchase Product via Purchase Invoice (Stock Increases)', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send({
        customer: customerId, type: 'purchase', invoiceDate: new Date(),
        items: [{ product: productId, name: 'Test Item', quantity: 20, rate: 50, totalAmount: 1000 }],
        subtotal: 1000, finalAmount: 1000
      });
    expect(res.status).toBe(201);
    
    const prodRes = await request(app).get(`/api/products/${productId}`);
    expect(prodRes.body.stockQty).toBe(65); // 45 + 20 = 65
  });

  it('4. Update Product Stock Manually', async () => {
    const res = await request(app)
      .put(`/api/products/${productId}`)
      .send({ name: 'Test Item', stockQty: 10 });
    expect(res.status).toBe(200);
    expect(res.body.stockQty).toBe(10);
  });
});
