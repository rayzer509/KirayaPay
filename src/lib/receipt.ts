import { format } from 'date-fns';

interface LineItem {
  description: string;
  amount: unknown;
}

interface ReceiptData {
  paymentId: string;
  paidAt: Date | string;
  tenant: { full_name: string; phone: string };
  property: { name: string };
  unit: { unit_number: string };
  cycleMonth: Date | string;
  lineItems: LineItem[];
  totalAmount: unknown;
  amountPaid: unknown;
  paymentMethod: string;
  upiRef?: string | null;
}

function rupees(val: unknown): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(val));
}

export async function downloadReceipt(data: ReceiptData) {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF({ format: 'a5', unit: 'mm' });
  const W = 148;
  const pad = 14;
  let y = 0;

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(26, 43, 76); // navy
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PropEase', pad, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Property Management', pad, 19);
  doc.setFontSize(9);
  doc.text('PAYMENT RECEIPT', W - pad, 13, { align: 'right' });
  doc.setFontSize(7.5);
  doc.text(`#${data.paymentId.slice(-8).toUpperCase()}`, W - pad, 19, { align: 'right' });
  y = 30;

  // ── Date + Cycle ──────────────────────────────────────────────────────────
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Date: ${format(new Date(data.paidAt), 'dd MMM yyyy')}`, pad, y);
  doc.text(`Billing cycle: ${format(new Date(data.cycleMonth), 'MMMM yyyy')}`, W - pad, y, { align: 'right' });
  y += 10;

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.setDrawColor(220, 218, 210);
  doc.line(pad, y, W - pad, y);
  y += 7;

  // ── Tenant + Property ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(26, 43, 76);
  doc.text('BILLED TO', pad, y);
  doc.text('PROPERTY', W / 2 + 4, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.text(data.tenant.full_name, pad, y);
  doc.text(data.property.name, W / 2 + 4, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(data.tenant.phone, pad, y);
  doc.text(`Unit ${data.unit.unit_number}`, W / 2 + 4, y);
  y += 10;

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.setDrawColor(220, 218, 210);
  doc.line(pad, y, W - pad, y);
  y += 8;

  // ── Line Items ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(26, 43, 76);
  doc.text('DESCRIPTION', pad, y);
  doc.text('AMOUNT', W - pad, y, { align: 'right' });
  y += 5;
  doc.setDrawColor(220, 218, 210);
  doc.line(pad, y, W - pad, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  for (const item of data.lineItems) {
    doc.text(item.description, pad, y);
    doc.text(rupees(item.amount), W - pad, y, { align: 'right' });
    y += 6;
  }

  y += 2;
  doc.setDrawColor(200, 198, 190);
  doc.line(pad, y, W - pad, y);
  y += 6;

  // ── Total ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 43, 76);
  doc.text('Total', pad, y);
  doc.text(rupees(data.totalAmount), W - pad, y, { align: 'right' });
  y += 7;

  // ── Payment Info ──────────────────────────────────────────────────────────
  doc.setFillColor(247, 246, 242);
  doc.roundedRect(pad, y, W - pad * 2, data.upiRef ? 22 : 16, 2, 2, 'F');
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(26, 43, 76);
  doc.text('Amount Paid', pad + 4, y);
  doc.text(rupees(data.amountPaid), W - pad - 4, y, { align: 'right' });
  y += 5;
  const methodLabel = data.paymentMethod === 'upi' ? 'UPI'
    : data.paymentMethod === 'cash' ? 'Cash'
    : data.paymentMethod === 'bank_transfer' ? 'Bank Transfer'
    : 'Other';
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Method: ${methodLabel}`, pad + 4, y);
  if (data.upiRef) {
    y += 5;
    doc.text(`UTR: ${data.upiRef}`, pad + 4, y);
  }
  y += 10;

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(160, 158, 150);
  doc.text('This is a system-generated receipt and does not require a signature.', W / 2, y, { align: 'center' });

  const filename = `receipt-${data.unit.unit_number}-${format(new Date(data.cycleMonth), 'MMM-yyyy')}.pdf`;
  doc.save(filename);
}
