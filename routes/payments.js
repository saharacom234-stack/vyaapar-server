const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/payments/invoice/:id  — all payments for one invoice
router.get('/invoice/:id', async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id, invoice: req.params.id })
      .populate('customer', 'name phone')
      .sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments
router.get('/', async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .populate('invoice', 'invoiceNo finalAmount')
      .populate('customer', 'name phone')
      .sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments
router.post('/', async (req, res) => {
  try {
    const { invoiceId, amount, method, referenceNo, date, notes } = req.body;

    const invoice = await Invoice.findOne({ _id: invoiceId, user: req.user._id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    if (amount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }

    if (amount > invoice.balanceDue) {
      return res.status(400).json({ message: `Payment amount (${amount}) exceeds the remaining invoice balance (${invoice.balanceDue})` });
    }

    const payment = await Payment.create({
      user: req.user._id,
      invoice: invoiceId,
      customer: invoice.customer,
      amount,
      method,
      referenceNo,
      date: date || Date.now(),
      notes,
    });

    // Update invoice payment status
    const newAmountPaid = (invoice.amountPaid || 0) + amount;
    const newBalance = invoice.finalAmount - newAmountPaid;
    let status = 'unpaid';
    if (newBalance <= 0) status = 'paid';
    else if (newAmountPaid > 0) status = 'partial';

    await Invoice.findByIdAndUpdate(invoiceId, {
      amountPaid: newAmountPaid,
      balanceDue: Math.max(0, newBalance),
      paymentStatus: status,
    });

    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/payments/:id
router.delete('/:id', async (req, res) => {
  try {
    const payment = await Payment.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (payment) {
      // Reverse the payment on invoice
      const invoice = await Invoice.findById(payment.invoice);
      if (invoice) {
        const newAmountPaid = Math.max(0, (invoice.amountPaid || 0) - payment.amount);
        const newBalance = invoice.finalAmount - newAmountPaid;
        let status = newAmountPaid === 0 ? 'unpaid' : 'partial';
        await Invoice.findByIdAndUpdate(payment.invoice, {
          amountPaid: newAmountPaid,
          balanceDue: newBalance,
          paymentStatus: status,
        });
      }
    }
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
