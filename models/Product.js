const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  SKU: { type: String, default: '', trim: true },
  barcode: { type: String, default: '', index: true, trim: true },
  category: { type: String, default: 'General' },
  unit: { type: String, default: 'pcs' }, // pcs, kg, litre, meter, box
  description: { type: String, default: '' },
  purchasePrice: { type: Number, required: true, default: 0 },
  sellingPrice: { type: Number, required: true, default: 0 },
  stockQty: { type: Number, default: 0 },
  minStock: { type: Number, default: 5 }, // low stock alert threshold
  HSNCode: { type: String, default: '' }, // HSN code for GST
  gstRate: { type: Number, default: 18, enum: [0, 5, 12, 18, 28] }, // GST percentage
  isActive: { type: Boolean, default: true },
  images: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
