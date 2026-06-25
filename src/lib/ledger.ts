type LedgerPayment = {
  amount_paid: number | string | { toNumber(): number };
  status?: 'submitted' | 'confirmed' | 'rejected';
};

type LedgerCharge = {
  amount: number | string | { toNumber(): number };
  due_date: Date | string;
  status?: string;
  allocations?: Array<{
    amount: number | string | { toNumber(): number };
    payment: { status?: 'submitted' | 'confirmed' | 'rejected' };
  }>;
};

export function moneyNumber(value: number | string | { toNumber(): number }) {
  if (typeof value === 'object' && 'toNumber' in value) return value.toNumber();
  if (typeof value === 'string') return Number(value);
  return value;
}

export function paymentTotals(payments: LedgerPayment[]) {
  return payments.reduce(
    (totals, payment) => {
      const status = payment.status ?? 'confirmed';
      const amount = moneyNumber(payment.amount_paid);
      if (status === 'confirmed') totals.confirmed += amount;
      if (status === 'submitted') totals.submitted += amount;
      if (status === 'rejected') totals.rejected += amount;
      return totals;
    },
    { confirmed: 0, submitted: 0, rejected: 0 },
  );
}

export function billStatusFromPayments(totalAmount: number, payments: LedgerPayment[]) {
  const totals = paymentTotals(payments);
  if (totals.confirmed >= totalAmount) return 'paid' as const;
  if (totals.confirmed > 0) return 'partial' as const;
  return 'sent' as const;
}

export function chargeLedger(charge: LedgerCharge, today = new Date()) {
  const totals = (charge.allocations ?? []).reduce(
    (sum, allocation) => {
      const status = allocation.payment.status ?? 'confirmed';
      const amount = moneyNumber(allocation.amount);
      if (status === 'confirmed') sum.confirmed += amount;
      if (status === 'submitted') sum.submitted += amount;
      if (status === 'rejected') sum.rejected += amount;
      return sum;
    },
    { confirmed: 0, submitted: 0, rejected: 0 },
  );

  const amount = moneyNumber(charge.amount);
  const dueDate = typeof charge.due_date === 'string' ? new Date(charge.due_date) : charge.due_date;
  const balance = Math.max(0, amount - totals.confirmed);

  let status: 'unpaid' | 'submitted' | 'partial' | 'paid' | 'overdue' | 'disputed' | 'void';
  if (charge.status === 'void' || charge.status === 'disputed') {
    status = charge.status;
  } else if (totals.confirmed >= amount) {
    status = 'paid';
  } else if (totals.confirmed > 0) {
    status = 'partial';
  } else if (totals.submitted > 0) {
    status = 'submitted';
  } else {
    status = dueDate < today ? 'overdue' : 'unpaid';
  }

  return {
    amount,
    confirmedAmount: totals.confirmed,
    submittedAmount: totals.submitted,
    rejectedAmount: totals.rejected,
    balance,
    status,
  };
}
