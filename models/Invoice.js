const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  HSNCode: { type: String, default: '' },
  unit: { type: String, default: 'pcs' },
  quantity: { type: Number, required: true, min: 1 },
  rate: { type: Number, required: true }, // price per unit
  discount: { type: Number, default: 0 }, // percentage
  gstRate: { type: Number, default: 0 }, // percentage
  taxableAmount: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
});

const invoiceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNo: { type: String, default: '' },
  type: { type: String, enum: ['sale', 'purchase'], default: 'sale' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  items: [invoiceItemSchema],
  // Totals
  subtotal: { type: Number, default: 0 },
  totalDiscount: { type: Number, default: 0 },
  totalTaxableAmount: { type: Number, default: 0 },
  totalCGST: { type: Number, default: 0 },
  totalSGST: { type: Number, default: 0 },
  totalIGST: { type: Number, default: 0 },
  totalGST: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },
  // GST type
  isInterState: { type: Boolean, default: false },
  // Payment
  paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid' },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  // Meta
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  signature: { type: String, default: '' },
}, { timestamps: true });

// Auto-generate invoice number BEFORE validation (so required check passes)
invoiceSchema.pre('validate', async function (next) {
  if (this.isNew && !this.invoiceNo) {
    const count = await mongoose.model('Invoice').countDocuments({ user: this.user });
    const prefix = this.type === 'sale' ? 'INV' : 'PUR';
    this.invoiceNo = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
