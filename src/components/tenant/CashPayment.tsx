'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';
import type { RouterOutputs } from '@/lib/trpc-types';

type Bill = RouterOutputs['billing']['billsForTenant'][number];

export function CashPayment({ bill, onSuccess }: { bill: Bill; onSuccess: () => void }) {
  const [note, setNote] = useState('');
  const notifyCash = trpc.payments.notifyCash.useMutation();

  const totalPaid = bill.payments
    .filter((p) => (p as any).status !== 'rejected')
    .reduce((s, p) => s + Number(p.amount_paid), 0);
  const outstanding = Number(bill.total_amount) - totalPaid;

  const [payAmount, setPayAmount] = useState(String(outstanding));
  const payAmountNum = parseFloat(payAmount) || 0;

  async function handleNotify() {
    if (payAmountNum <= 0) return toast.error('Enter a valid amount');
    if (payAmountNum > outstanding) return toast.error(`Amount cannot exceed outstanding ${formatCurrency(outstanding)}`);
    try {
      await notifyCash.mutateAsync({ bill_id: bill.id, amount_paid: payAmountNum, note: note || undefined });
      toast.success('Landlord has been notified of your cash payment');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to notify');
    }
  }

  return (
    <div className="space-y-4">
      {/* Amount input */}
      <div className="p-3 bg-slate-light rounded-xl">
        <p className="text-xs text-slate mb-1 text-center">
          Outstanding: {formatCurrency(outstanding)}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-navy">₹</span>
          <input
            type="number"
            step="1"
            min="1"
            max={outstanding}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="flex-1 text-2xl font-bold money text-navy bg-transparent border-b-2 border-navy/30 focus:border-navy focus:outline-none text-center"
          />
        </div>
        {payAmountNum < outstanding && payAmountNum > 0 && (
          <p className="text-xs text-amber-700 text-center mt-1">
            Partial payment — {formatCurrency(outstanding - payAmountNum)} will remain outstanding
          </p>
        )}
      </div>

      <p className="text-sm text-slate text-center">
        Hand over the cash to your landlord and click the button below to send them a notification.
      </p>

      <div>
        <label className="text-sm font-medium text-navy block mb-1">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Paid to security guard on 5th floor"
          className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron"
        />
      </div>

      <button
        onClick={handleNotify}
        disabled={payAmountNum <= 0 || notifyCash.isLoading}
        className="w-full py-2.5 rounded-lg bg-navy hover:bg-navy/90 text-white font-semibold text-sm transition disabled:opacity-50"
      >
        {notifyCash.isLoading ? 'Notifying…' : 'Notify Landlord'}
      </button>
    </div>
  );
}
