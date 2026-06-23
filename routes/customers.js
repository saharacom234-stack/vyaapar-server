const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const { protect } = require('../middleware/auth');

router.use(protect);

// Helper: compute live balance = opening balance + (sale unpaid) - (purchase unpaid)
const computeLiveBalance = async (customer) => {
  const invoiceAgg = await Invoice.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(customer.user),
        customer: new mongoose.Types.ObjectId(customer._id)
      }
    },
    {
      $group: {
        _id: '$type',
        totalInvoiced: { $sum: '$finalAmount' },
        totalPaid: { $sum: '$amountPaid' }
      }
    }
  ]);

  let salesTotal = 0, salesPaid = 0;
  let purchaseTotal = 0, purchasePaid = 0;

  invoiceAgg.forEach(agg => {
    if (agg._id === 'sale' || !agg._id) {
      salesTotal += agg.totalInvoiced;
      salesPaid += agg.totalPaid;
    } else if (agg._id === 'purchase') {
      purchaseTotal += agg.totalInvoiced;
      purchasePaid += agg.totalPaid;
    }
  });

  // Base balance based on manual entry (receivable is +, payable is -)
  const baseBalance = customer.balanceType === 'payable' 
    ? -(customer.openingBalance || 0) 
    : (customer.openingBalance || 0);

  // liveBalance > 0 means they owe us; < 0 means we owe them
  const liveBalance = baseBalance + (salesTotal - salesPaid) - (purchaseTotal - purchasePaid);

  return { totalInvoiced: salesTotal, totalPaid: salesPaid, liveBalance };
};

// GET /api/customers?type=customer|supplier&search=
// Returns customers with computed liveBalance attached
router.get('/', async (req, res) => {
  try {
    const { type, search } = req.query;
    const query = { user: req.user._id };
    if (type) query.type = type;
    if (search) query.name = { $regex: search, $options: 'i' };
    const customers = await Customer.find(query).sort({ createdAt: -1 });

    // Attach live balance computed from invoices + payments
    const enriched = await Promise.all(customers.map(async (c) => {
      const obj = c.toObject();
      if (c.type === 'customer') {
        const { totalInvoiced, totalPaid, liveBalance } = await computeLiveBalance(c);
        obj.totalInvoiced = totalInvoiced;
        obj.totalPaid = totalPaid;
        obj.liveBalance = liveBalance; // what customer still owes
      }
      return obj;
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    const obj = customer.toObject();
    if (customer.type === 'customer') {
      const { totalInvoiced, totalPaid, liveBalance } = await computeLiveBalance(customer);
      obj.totalInvoiced = totalInvoiced;
      obj.totalPaid = totalPaid;
      obj.liveBalance = liveBalance;
    }
    res.json(obj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const customer = await Customer.create({ ...req.body, user: req.user._id });
    res.status(201).json(customer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    await Customer.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
