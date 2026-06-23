const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');
const { calculateInvoiceTotals } = require('../utils/gst');
const { generateInvoicePDF, generateReceiptPDF } = require('../utils/pdfGenerator');
const { notify } = require('../utils/notify');
const User = require('../models/User');

router.use(protect);

// GET /api/invoices/:id/receipt
router.get('/:id/receipt', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('customer')
      .populate('items.product');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    const business = await User.findById(req.user._id);
    generateReceiptPDF(invoice, business, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/invoices?type=sale|purchase&status=paid|unpaid|partial&page=1
router.get('/', async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 20 } = req.query;
    const query = { user: req.user._id };
    if (type) query.type = type;
    if (status) query.paymentStatus = status;

    const invoices = await Invoice.find(query)
      .populate('customer', 'name phone email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);
    res.json({ invoices, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('customer')
      .populate('items.product', 'name SKU');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/invoices
router.post('/', async (req, res) => {
  try {
    const { items, isInterState, type, ...rest } = req.body;

    // Calculate GST
    const totals = calculateInvoiceTotals(items, isInterState);

    const invoice = await Invoice.create({
      user: req.user._id,
      type: type || 'sale',
      isInterState: isInterState || false,
      items: totals.items,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTaxableAmount: totals.totalTaxableAmount,
      totalCGST: totals.totalCGST,
      totalSGST: totals.totalSGST,
      totalIGST: totals.totalIGST,
      totalGST: totals.totalGST,
      totalAmount: totals.totalAmount,
      roundOff: totals.roundOff,
      finalAmount: totals.finalAmount,
      balanceDue: totals.finalAmount,
      ...rest,
    });

    // Reduce stock for sale invoices
    if (type === 'sale' || !type) {
      for (const item of items) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stockQty: -item.quantity }
          });
        }
      }
    }

    // Increase stock for purchase invoices
    if (type === 'purchase') {
      for (const item of items) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stockQty: item.quantity }
          });
        }
      }
    }

    await invoice.save();

    // Trigger persistent notification
    notify(
      req.user._id,
      'Invoice Created',
      `Invoice #${invoice.invoiceNo} for ${type === 'sale' ? 'Sale' : 'Purchase'} was successfully created.`,
      'success',
      'FileText'
    );

    const populated = await Invoice.findById(invoice._id).populate('customer', 'name phone email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/invoices/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { paymentStatus, amountPaid } = req.body;
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { paymentStatus, amountPaid, balanceDue: 0 },
      { new: true }
    );
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/invoices/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('customer')
      .populate('items.product');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    generateInvoicePDF(invoice, req.user, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    await Invoice.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
