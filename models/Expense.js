const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: {
    type: String,
    required: true,
    enum: [
      'Rent', 'Salary', 'Electricity', 'Transport', 'Marketing',
      'Office Supplies', 'Raw Materials', 'Maintenance', 'Taxes', 'Other'
    ],
    default: 'Other',
  },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  description: { type: String, default: '' },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'],
    default: 'cash',
  },
  referenceNo: { type: String, default: '' },
  receipt: { type: String, default: '' }, // image path
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
