const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const uid = req.user._id;
    const { range } = req.query; // 'today', 'week', 'month', 'year', 'all'
    const now = new Date();
    
    let startDate = new Date(0); // default 'all'
    if (range === 'today') {
      startDate = new Date(now.setHours(0,0,0,0));
    } else if (range === 'week') {
      startDate = new Date(now.setDate(now.getDate() - now.getDay()));
      startDate.setHours(0,0,0,0);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [
      totalSales, monthSales, totalReceivables, totalPayable,
      totalExpenses, monthExpenses, totalCustomers, totalProducts,
      lowStockProducts, unpaidInvoices
    ] = await Promise.all([
      // Total sales revenue (filtered by range)
      Invoice.aggregate([
        { $match: { user: uid, type: 'sale', invoiceDate: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } },
      ]),
      // This month's sales
      Invoice.aggregate([
        { $match: { user: uid, type: 'sale', invoiceDate: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } },
      ]),
      // Total receivables (unpaid + partial sales invoices)
      Invoice.aggregate([
        { $match: { user: uid, type: 'sale', paymentStatus: { $in: ['unpaid', 'partial'] } } },
        { $group: { _id: null, total: { $sum: '$balanceDue' } } },
      ]),
      // Total payable (purchase invoices)
      Invoice.aggregate([
        { $match: { user: uid, type: 'purchase', paymentStatus: { $in: ['unpaid', 'partial'] } } },
        { $group: { _id: null, total: { $sum: '$balanceDue' } } },
      ]),
      // Total expenses (filtered by range)
      Expense.aggregate([
        { $match: { user: uid, date: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // This month's expenses
      Expense.aggregate([
        { $match: { user: uid, date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Customer.countDocuments({ user: uid, type: 'customer', createdAt: { $gte: startDate } }),
      Product.countDocuments({ user: uid, isActive: true }),
      Product.countDocuments({ user: uid, isActive: true, $expr: { $lte: ['$stockQty', '$minStock'] } }),
      Invoice.countDocuments({ user: uid, paymentStatus: { $in: ['unpaid', 'partial'] } }),
    ]);

    res.json({
      totalSales: totalSales[0]?.total || 0,
      monthSales: monthSales[0]?.total || 0,
      totalReceivables: totalReceivables[0]?.total || 0,
      totalPayable: totalPayable[0]?.total || 0,
      totalExpenses: totalExpenses[0]?.total || 0,
      monthExpenses: monthExpenses[0]?.total || 0,
      totalCustomers,
      totalProducts,
      lowStockProducts,
      unpaidInvoices,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/sales-chart (last 6 months)
router.get('/sales-chart', async (req, res) => {
  try {
    const uid = req.user._id;
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const data = await Invoice.aggregate([
      { $match: { user: uid, type: 'sale', createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$finalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const chart = months.map(({ year, month }) => {
      const found = data.find(d => d._id.year === year && d._id.month === month);
      return {
        label: new Date(year, month - 1).toLocaleString('en-IN', { month: 'short' }),
        sales: found?.total || 0,
        count: found?.count || 0,
      };
    });

    res.json(chart);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/top-products
router.get('/top-products', async (req, res) => {
  try {
    const data = await Invoice.aggregate([
      { $match: { user: req.user._id, type: 'sale' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.totalAmount' } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/expense-by-category
router.get('/expense-by-category', async (req, res) => {
  try {
    const data = await Expense.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/recent-invoices
router.get('/recent-invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user._id })
      .populate('customer', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/search?q=
router.get('/search', protect, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q || q.length < 2) return res.json({ customers: [], products: [], invoices: [] });

    const regex = new RegExp(q, 'i');

    const [customers, products, invoices] = await Promise.all([
      Customer.find({ user: req.user._id, $or: [{ name: regex }, { phone: regex }] }).limit(5),
      Product.find({ user: req.user._id, $or: [{ name: regex }, { sku: regex }] }).limit(5),
      Invoice.find({ user: req.user._id, $or: [{ invoiceNumber: regex }, { 'customer.name': regex }] }).limit(5),
    ]);

    res.json({ customers, products, invoices });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
