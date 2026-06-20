'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';
import type { RouterOutputs } from '@/lib/trpc-types';

type Bill = RouterOutputs['billing']['billsForTenant'][number];

interface Props {
  bill: Bill;
  onSuccess: () => void;
}

export function UPIPayment({ bill, onSuccess }: Props) {
  const [utr, setUtr] = useState('');
  const [copied, setCopied] = useState(false);

  const submitUtr = trpc.payments.submitUtr.useMutation();

  const upiId = bill.unit.property.upi_id;
  const upiQr = bill.unit.property.upi_qr_url;
  const totalPaid = bill.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
  const outstanding = Number(bill.total_amount) - totalPaid;

  async function copyUpiId() {
    if (!upiId) return;
    await navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('UPI ID copied!');
  }

  async function handleSubmit() {
    if (utr.length !== 12) return toast.error('UTR must be exactly 12 digits');
    try {
      await submitUtr.mutateAsync({ bill_id: bill.id, upi_ref: utr, amount_paid: outstanding });
      toast.success('Payment submitted! Landlord will verify shortly.');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    }
  }

  const steps = [
    'Open your UPI app (PhonePe, GPay, Paytm)',
    'Scan the QR or enter the UPI ID',
    `Pay exactly ${formatCurrency(outstanding)}`,
    'Copy the 12-digit UTR and submit below',
  ];

  return (
    <div className="space-y-4">
      {/* Amount */}
      <div className="text-center p-3 bg-saffron-light rounded-xl">
        <p className="text-xs text-slate mb-0.5">Amount to Pay</p>
        <p className="text-3xl font-bold money text-navy">{formatCurrency(outstanding)}</p>
      </div>

      {/* QR */}
      {upiQr && (
        <div className="flex justify-center">
          <Image src={upiQr} alt="UPI QR Code" width={160} height={160} className="rounded-xl border border-border" />
        </div>
      )}

      {/* UPI ID */}
      {upiId && (
        <div className="flex items-center justify-between p-3 bg-slate-light rounded-lg">
          <div>
            <p className="text-xs text-slate">UPI ID</p>
            <p className="font-medium text-navy money">{upiId}</p>
          </div>
          <button onClick={copyUpiId} className="p-2 rounded-lg hover:bg-border transition">
            {copied ? <Check className="w-4 h-4 text-sage" /> : <Copy className="w-4 h-4 text-slate" />}
          </button>
        </div>
      )}

      {/* Steps */}
      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate">
            <span className="w-5 h-5 rounded-full bg-saffron-light text-saffron text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      {/* UTR Input */}
      <div>
        <label className="text-sm font-medium text-navy block mb-1">UTR / Transaction Reference</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={12}
          placeholder="12-digit UTR number"
          value={utr}
          onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm reading focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron"
        />
        {utr.length > 0 && utr.length < 12 && (
          <p className="text-xs text-slate mt-1">{12 - utr.length} more digits needed</p>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={utr.length !== 12 || submitUtr.isLoading}
        className="w-full py-2.5 rounded-lg bg-saffron hover:bg-saffron/90 text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitUtr.isLoading ? 'Submitting…' : 'Submit UTR for Verification'}
      </button>
    </div>
  );
}
