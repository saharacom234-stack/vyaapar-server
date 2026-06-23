const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/vyaapar';

async function getSameerData() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Load models
  const Customer = require('../models/Customer');
  const Invoice = require('../models/Invoice');
  const Payment = require('../models/Payment');

  // Find customer named Sameer (case-insensitive)
  const sameer = await Customer.findOne({ name: { $regex: /sameer/i } });
  
  if (!sameer) {
    console.log('❌ No customer named Sameer found in database');
    await mongoose.disconnect();
    return;
  }

  console.log('\n======================================');
  console.log('👤 CUSTOMER: SAMEER');
  console.log('======================================');
  console.log(JSON.stringify({
    id: sameer._id,
    name: sameer.name,
    phone: sameer.phone,
    email: sameer.email,
    GSTIN: sameer.GSTIN,
    openingBalance: sameer.openingBalance,
    balanceType: sameer.balanceType,
    address: sameer.address,
    createdAt: sameer.createdAt,
  }, null, 2));

  // Get all invoices for Sameer
  const invoices = await Invoice.find({ customer: sameer._id }).sort({ invoiceDate: 1 });
  
  console.log(`\n======================================`);
  console.log(`🧾 INVOICES (${invoices.length} total)`);
  console.log(`======================================`);
  invoices.forEach((inv, i) => {
    console.log(`\n[${i+1}] ${inv.invoiceNo} | ${inv.type.toUpperCase()} | ${new Date(inv.invoiceDate).toLocaleDateString('en-IN')}`);
    console.log(`    Total Amount : ₹${inv.finalAmount}`);
    console.log(`    Amount Paid  : ₹${inv.amountPaid || 0}`);
    console.log(`    Balance Due  : ₹${inv.balanceDue || 0}`);
    console.log(`    Status       : ${inv.paymentStatus.toUpperCase()}`);
    console.log(`    Items        : ${inv.items.length} item(s)`);
    inv.items.forEach(item => {
      console.log(`      - ${item.name} | Qty: ${item.quantity} | Rate: ₹${item.rate} | Total: ₹${item.totalAmount}`);
    });
  });

  // Get all payments for Sameer
  const payments = await Payment.find({ customer: sameer._id }).populate('invoice', 'invoiceNo').sort({ date: 1 });

  console.log(`\n======================================`);
  console.log(`💵 PAYMENTS (${payments.length} total)`);
  console.log(`======================================`);
  payments.forEach((p, i) => {
    console.log(`\n[${i+1}] ₹${p.amount} | ${p.method.toUpperCase()} | ${new Date(p.date).toLocaleDateString('en-IN')}`);
    console.log(`    Invoice Ref  : ${p.invoice?.invoiceNo || 'N/A'}`);
    console.log(`    Reference No : ${p.referenceNo || '—'}`);
    console.log(`    Notes        : ${p.notes || '—'}`);
  });

  // Compute ledger summary
  const totalInvoiced = invoices.filter(i => i.type === 'sale').reduce((s, i) => s + i.finalAmount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const liveBalance = totalInvoiced - totalPaid;

  console.log(`\n======================================`);
  console.log(`📊 LEDGER SUMMARY`);
  console.log(`======================================`);
  console.log(`  Opening Balance (manual) : ₹${sameer.openingBalance || 0} (${sameer.balanceType})`);
  console.log(`  Total Invoiced (sales)   : ₹${totalInvoiced}`);
  console.log(`  Total Payments Received  : ₹${totalPaid}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Live Outstanding Balance : ₹${liveBalance}`);
  console.log(`  Status                   : ${liveBalance === 0 ? '✅ FULLY CLEARED' : liveBalance > 0 ? '🔴 SAMEER OWES YOU' : '🔵 YOU OWE SAMEER (OVERPAID)'}`);

  await mongoose.disconnect();
  console.log('\nDone.');
}

getSameerData().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
