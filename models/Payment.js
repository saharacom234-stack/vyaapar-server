const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  method: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'],
    default: 'cash',
  },
  referenceNo: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
