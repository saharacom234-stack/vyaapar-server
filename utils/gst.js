/**
 * GST Calculation Utilities for Vyaapar
 * Supports CGST+SGST (intra-state) and IGST (inter-state)
 */

/**
 * Calculate GST for a single invoice item
 * @param {number} rate - price per unit
 * @param {number} quantity
 * @param {number} discountPct - discount percentage
 * @param {number} gstRate - GST percentage (0, 5, 12, 18, 28)
 * @param {boolean} isInterState - true if inter-state supply
 */
const calculateItemGST = (rate, quantity, discountPct = 0, gstRate = 0, isInterState = false) => {
  const grossAmount = rate * quantity;
  const discountAmount = (grossAmount * discountPct) / 100;
  const taxableAmount = grossAmount - discountAmount;

  let cgst = 0, sgst = 0, igst = 0;

  if (isInterState) {
    igst = (taxableAmount * gstRate) / 100;
  } else {
    cgst = (taxableAmount * gstRate) / 2 / 100;
    sgst = (taxableAmount * gstRate) / 2 / 100;
  }

  const totalGST = cgst + sgst + igst;
  const totalAmount = taxableAmount + totalGST;

  return {
    grossAmount: round2(grossAmount),
    discountAmount: round2(discountAmount),
    taxableAmount: round2(taxableAmount),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    totalGST: round2(totalGST),
    totalAmount: round2(totalAmount),
  };
};

/**
 * Calculate totals for all invoice items
 */
const calculateInvoiceTotals = (items, isInterState = false) => {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTaxableAmount = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;

  const processedItems = items.map((item) => {
    const calc = calculateItemGST(
      item.rate,
      item.quantity,
      item.discount || 0,
      item.gstRate || 0,
      isInterState
    );
    subtotal += calc.grossAmount;
    totalDiscount += calc.discountAmount;
    totalTaxableAmount += calc.taxableAmount;
    totalCGST += calc.cgst;
    totalSGST += calc.sgst;
    totalIGST += calc.igst;

    return {
      ...item,
      taxableAmount: calc.taxableAmount,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      totalAmount: calc.totalAmount,
    };
  });

  const totalGST = round2(totalCGST + totalSGST + totalIGST);
  const totalAmount = round2(totalTaxableAmount + totalGST);
  const roundOff = round2(Math.round(totalAmount) - totalAmount);
  const finalAmount = round2(totalAmount + roundOff);

  return {
    items: processedItems,
    subtotal: round2(subtotal),
    totalDiscount: round2(totalDiscount),
    totalTaxableAmount: round2(totalTaxableAmount),
    totalCGST: round2(totalCGST),
    totalSGST: round2(totalSGST),
    totalIGST: round2(totalIGST),
    totalGST,
    totalAmount,
    roundOff,
    finalAmount,
  };
};

const round2 = (val) => Math.round(val * 100) / 100;

module.exports = { calculateItemGST, calculateInvoiceTotals, round2 };
