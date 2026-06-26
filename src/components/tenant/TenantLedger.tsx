'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import toast from 'react-hot-toast';
import { trpc } from '@/lib/trpc';
import { chargeLedger, moneyNumber } from '@/lib/ledger';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { AlertCircle, CheckCircle2, Clock, Receipt } from 'lucide-react';

// ─── Payment submission panel (lease-centric) ────────────────────────────────
function PayPanel({
  leaseId,
  outstanding,
  upiId,
  onSuccess,
}: {
  leaseId: string;
  outstanding: number;
  upiId?: string | null;
  onSuccess: () => void;
}) {
  const [tab, setTab]         = useState<'upi' | 'cash'>('upi');
  const [amount, setAmount]   = useState(String(Math.max(0, Math.round(outstanding))));
  const [utr, setUtr]         = useState('');
  const [note, setNote]       = useState('');
  const [copied, setCopied]   = useState(false);

  const amountNum = parseFloat(amount) || 0;

  const submitUtr   = trpc.payments.submitUtr.useMutation();
  const notifyCash  = trpc.payments.notifyCash.useMutation();

  async function handleUpi() {
    if (utr.length !== 12) return toast.error('UTR must be exactly 12 digits');
    if (amountNum <= 0) return toast.error('Enter a valid amount');
    if (amountNum > outstanding + 0.01) return toast.error(`Amount exceeds outstanding ${formatCurrency(outstanding)}`);
    try {
      await submitUtr.mutateAsync({ lease_id: leaseId, upi_ref: utr, amount_paid: amountNum });
      toast.success('UTR submitted — landlord will verify shortly');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    }
  }

  async function handleCash() {
    if (amountNum <= 0) return toast.error('Enter a valid amount');
    if (amountNum > outstanding + 0.01) return toast.error(`Amount exceeds outstanding ${formatCurrency(outstanding)}`);
    try {
      await notifyCash.mutateAsync({ lease_id: leaseId, amount_paid: amountNum, note: note || undefined });
      toast.success('Landlord notified of cash payment');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to notify');
    }
  }

  async function copyUpi() {
    if (!upiId) return;
    await navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('UPI ID copied!');
  }

  return (
    <div className="space-y-4">
      {/* Amount */}
      <div className="p-3 bg-saffron-light rounded-xl">
        <p className="text-xs text-slate mb-1 text-center">Outstanding: {formatCurrency(outstanding)}</p>
        <div className="flex items-center gap-2 justify-center">
          <span className="text-lg font-bold text-navy">₹</span>
          <input
            type="number"
            step="1"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-2xl font-bold money text-navy bg-transparent border-b-2 border-saffron focus:outline-none text-center w-40"
          />
        </div>
        {amountNum < outstanding && amountNum > 0 && (
          <p className="text-xs text-amber-700 text-center mt-1">
            Partial — {formatCurrency(outstanding - amountNum)} will remain outstanding
          </p>
        )}
      </div>

      {/* UPI / Cash tabs */}
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as 'upi' | 'cash')}>
        <Tabs.List className="flex gap-1 p-1 bg-slate-light rounded-lg mb-3">
          <Tabs.Trigger value="upi"  className="flex-1 py-1.5 rounded-md text-sm font-medium text-slate uppercase data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition">UPI</Tabs.Trigger>
          <Tabs.Trigger value="cash" className="flex-1 py-1.5 rounded-md text-sm font-medium text-slate uppercase data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition">Cash</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="upi" className="space-y-3">
          {upiId && (
            <div className="flex items-center justify-between p-3 bg-slate-light rounded-lg">
              <div>
                <p className="text-xs text-slate">UPI ID</p>
                <p className="font-medium text-navy money">{upiId}</p>
              </div>
              <button onClick={copyUpi} className="text-xs text-sage font-medium px-3 py-1 rounded-lg border border-sage/30 hover:bg-sage-light transition">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-navy block mb-1">UTR / Transaction Reference</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              placeholder="12-digit UTR"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm reading focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron"
            />
            {utr.length > 0 && utr.length < 12 && (
              <p className="text-xs text-slate mt-1">{12 - utr.length} more digits needed</p>
            )}
          </div>
          <button
            onClick={handleUpi}
            disabled={utr.length !== 12 || amountNum <= 0 || submitUtr.isLoading}
            className="w-full py-2.5 rounded-lg bg-saffron hover:bg-saffron/90 text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitUtr.isLoading ? 'Submitting…' : 'Submit UTR for Verification'}
          </button>
        </Tabs.Content>

        <Tabs.Content value="cash" className="space-y-3">
          <p className="text-sm text-slate text-center">
            Hand over the cash to your landlord and send a notification below.
          </p>
          <div>
            <label className="text-sm font-medium text-navy block mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid to security guard on 5th"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron"
            />
          </div>
          <button
            onClick={handleCash}
            disabled={amountNum <= 0 || notifyCash.isLoading}
            className="w-full py-2.5 rounded-lg bg-navy hover:bg-navy/90 text-white font-semibold text-sm transition disabled:opacity-50"
          >
            {notifyCash.isLoading ? 'Notifying…' : 'Notify Landlord'}
          </button>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

// ─── Charge status icon ──────────────────────────────────────────────────────
function ChargeStatusIcon({ status }: { status: string }) {
  if (status === 'paid')    return <CheckCircle2 className="w-4 h-4 text-sage shrink-0" />;
  if (status === 'overdue') return <AlertCircle className="w-4 h-4 text-coral shrink-0" />;
  return <Clock className="w-4 h-4 text-slate shrink-0" />;
}

// ─── Main ledger component ───────────────────────────────────────────────────
export function TenantLedger({ leaseId, upiId }: { leaseId: string; upiId?: string | null }) {
  const [payOpen, setPayOpen] = useState(false);

  const { data: charges, refetch } = trpc.billing.myCharges.useQuery();
  const { data: historyData }      = trpc.billing.paymentHistory.useQuery();

  if (!charges) return <div className="h-32 rounded-xl bg-surface border border-border animate-pulse" />;

  const now     = new Date();
  const ledger  = charges.map((c) => ({ ...c, ...chargeLedger(c, now) }));
  const outstanding = ledger
    .filter((c) => c.status !== 'paid' && c.status !== 'void')
    .reduce((s, c) => s + c.balance, 0);

  const pendingCharges = ledger.filter((c) => ['unpaid', 'partial', 'overdue', 'submitted'].includes(c.status));
  const paidCharges    = ledger.filter((c) => c.status === 'paid');

  const fyStart = historyData
    ? new Date(historyData.fyStart)
    : (() => {
        const d = new Date();
        return d.getMonth() >= 3
          ? new Date(d.getFullYear(), 3, 1)
          : new Date(d.getFullYear() - 1, 3, 1);
      })();

  return (
    <div className="space-y-4">
      {/* Outstanding balance card */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Outstanding Balance</p>
            <p className={`text-2xl font-bold money ${outstanding > 0 ? 'text-coral' : 'text-sage'}`}>
              {formatCurrency(outstanding)}
            </p>
            {outstanding === 0 && (
              <p className="text-xs text-sage mt-0.5">You're all clear!</p>
            )}
          </div>
          {outstanding > 0 && (
            <button
              onClick={() => setPayOpen(!payOpen)}
              className="px-4 py-2 rounded-lg bg-saffron hover:bg-saffron/90 text-white font-semibold text-sm transition"
            >
              {payOpen ? 'Cancel' : 'Make Payment'}
            </button>
          )}
        </div>

        {payOpen && outstanding > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <PayPanel
              leaseId={leaseId}
              outstanding={outstanding}
              upiId={upiId}
              onSuccess={() => { setPayOpen(false); refetch(); }}
            />
          </div>
        )}
      </Card>

      {/* Pending charges */}
      {pendingCharges.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate uppercase tracking-wide mb-2">Outstanding</h3>
          <div className="space-y-2">
            {pendingCharges.map((c) => (
              <Card key={c.id} className="py-3">
                <div className="flex items-start gap-3">
                  <ChargeStatusIcon status={c.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-navy text-sm">{c.title}</p>
                      <p className="money font-bold text-navy shrink-0">{formatCurrency(c.balance)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-slate">Due {formatDate(c.due_date)}</p>
                      {c.status === 'partial' && (
                        <span className="text-xs text-amber-700">
                          ₹{formatCurrency(c.confirmedAmount)} paid · ₹{formatCurrency(c.balance)} remaining
                        </span>
                      )}
                      {c.status === 'submitted' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Payment pending verification
                        </span>
                      )}
                      {c.status === 'overdue' && (
                        <span className="text-xs text-coral font-medium">Overdue</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingCharges.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="font-semibold text-navy">No pending charges</p>
          <p className="text-sm text-slate">All your charges are settled</p>
        </div>
      )}

      {/* Payment history */}
      {historyData && (
        <div>
          <h3 className="text-sm font-semibold text-slate uppercase tracking-wide mb-2">Payment History</h3>
          <Card className="mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Total Paid — FY {fyStart.getFullYear()}–{fyStart.getFullYear() + 1}</p>
                <p className="text-lg font-bold money text-navy">{formatCurrency(historyData.totalThisFY)}</p>
              </div>
              <Receipt className="w-5 h-5 text-slate" />
            </div>
          </Card>
          {historyData.payments.map((p) => (
            <Card key={p.id} className="py-3 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold money text-sage">{formatCurrency(Number(p.amount_paid))}</p>
                  <p className="text-xs text-slate mt-0.5 capitalize">
                    {p.payment_method.replace('_', ' ')}
                    {p.upi_ref ? ` · UTR ${p.upi_ref}` : ''}
                  </p>
                </div>
                <p className="text-xs text-slate">{formatDate(p.paid_at)}</p>
              </div>
            </Card>
          ))}
          {historyData.payments.length === 0 && (
            <p className="text-sm text-slate italic text-center py-4">No payments yet</p>
          )}
        </div>
      )}
    </div>
  );
}
