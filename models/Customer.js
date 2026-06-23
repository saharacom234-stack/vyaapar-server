const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['customer', 'supplier'], default: 'customer' },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '' },
  email: { type: String, default: '', lowercase: true },
  GSTIN: { type: String, default: '', uppercase: true },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
  },
  openingBalance: { type: Number, default: 0 },
  balanceType: { type: String, enum: ['receivable', 'payable'], default: 'receivable' },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
