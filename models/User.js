const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  businessName: { type: String, required: true, trim: true },
  businessType: { type: String, default: 'Retail' },
  GSTIN: { type: String, default: '', uppercase: true },
  phone: { type: String, default: '' },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
  },
  logo: { type: String, default: '' },
  currency: { type: String, default: '₹' },
  financialYear: { type: String, default: '2024-25' },
  role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
