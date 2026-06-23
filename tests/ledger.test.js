const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Import routes & models
const authRoutes = require('../routes/auth');
const customerRoutes = require('../routes/customers');
const invoiceRoutes = require('../routes/invoices');
const paymentRoutes = require('../routes/payments');

const User = require('../models/User');

let app;
let authToken;
let userId;

beforeAll(async () => {
  // Use a dedicated test database to avoid messing with real data
  await mongoose.connect('mongodb://localhost:27017/vyaapar_test');
  
  // Clean DB before starting
  await mongoose.connection.db.dropDatabase();

  app = express();
  app.use(express.json());
  
  // Set up mock auth token middleware for testing
  app.use((req, res, next) => {
    if (authToken) {
      req.headers.authorization = `Bearer ${authToken}`;
    }
    next();
  });

  // Load standard routes
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/payments', paymentRoutes);

  // Setup mock user
  const user = await User.create({
    name: 'Test User',
    email: 'test@test.com',
    password: 'password123',
    businessName: 'Test Business',
    phone: '9999999999',
    pin: '1234',
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

describe('Ledger Calculation Logic', () => {
  let customerId;
  let saleInvoiceId;
  let purchaseInvoiceId;
  let paymentId;

  it('1. Create Customer with Receivable Opening Balance', async () => {
    const res = await request(app)
      .post('/api/customers')
      .send({ name: 'Test Customer', openingBalance: 5000, balanceType: 'receivable' });
    expect(res.status).toBe(201);
    customerId = res.body._id;

    const checkRes = await request(app).get(`/api/customers/${customerId}`);
    expect(checkRes.body.liveBalance).toBe(5000); // Owes us 5000
  });

  it('2. Create a Sales Invoice', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send({
        customer: customerId, type: 'sale', invoiceDate: new Date(),
        items: [{ name: 'Item', quantity: 1, rate: 1000, totalAmount: 1000 }],
        subtotal: 1000, finalAmount: 1000
      });
    expect(res.status).toBe(201);
    saleInvoiceId = res.body._id;
    
    // 5000 (opening) + 1000 (sale) = 6000
    const checkRes = await request(app).get(`/api/customers/${customerId}`);
    expect(checkRes.body.liveBalance).toBe(6000);
  });

  it('3. Record a Payment against Sale', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({ invoiceId: saleInvoiceId, amount: 500, method: 'cash', date: new Date() });
    expect(res.status).toBe(201);
    paymentId = res.body._id;

    // 6000 - 500 (payment) = 5500
    const checkRes = await request(app).get(`/api/customers/${customerId}`);
    expect(checkRes.body.liveBalance).toBe(5500);
  });

  it('4. Delete a Payment (should revert balance)', async () => {
    const res = await request(app).delete(`/api/payments/${paymentId}`);
    expect(res.status).toBe(200);

    // Balance should revert from 5500 back to 6000
    const checkRes = await request(app).get(`/api/customers/${customerId}`);
    expect(checkRes.body.liveBalance).toBe(6000);
  });

  it('5. Create a Purchase Invoice (Payable)', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send({
        customer: customerId, type: 'purchase', invoiceDate: new Date(),
        items: [{ name: 'Purchased Item', quantity: 1, rate: 2000, totalAmount: 2000 }],
        subtotal: 2000, finalAmount: 2000
      });
    expect(res.status).toBe(201);
    purchaseInvoiceId = res.body._id;

    // 6000 - 2000 (purchase) = 4000
    const checkRes = await request(app).get(`/api/customers/${customerId}`);
    expect(checkRes.body.liveBalance).toBe(4000);
  });

  it('6. Record Payment against Purchase (Sending Money)', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({ invoiceId: purchaseInvoiceId, amount: 500, method: 'cash', date: new Date() });
    expect(res.status).toBe(201);

    // 4000 + 500 (we paid them 500, so our debt decreased, net balance they owe us increases) = 4500
    const checkRes = await request(app).get(`/api/customers/${customerId}`);
    expect(checkRes.body.liveBalance).toBe(4500);
  });

  it('6.5 Prevent Overpayment of Invoice', async () => {
    // purchaseInvoiceId has a balance of 1500 (2000 initial - 500 paid)
    const res = await request(app)
      .post('/api/payments')
      .send({ invoiceId: purchaseInvoiceId, amount: 2000, method: 'cash', date: new Date() });
    
    // Should be rejected with 400 Bad Request
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('exceeds the remaining invoice balance');
  });

  it('7. Delete an Invoice (should revert balance)', async () => {
    // Delete the sale invoice (was +1000)
    await request(app).delete(`/api/invoices/${saleInvoiceId}`);
    
    // 4500 - 1000 = 3500
    const checkRes = await request(app).get(`/api/customers/${customerId}`);
    expect(checkRes.body.liveBalance).toBe(3500);
  });
});
