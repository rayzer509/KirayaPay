'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import toast from 'react-hot-toast';

export default function PaymentsPage() {
  const [markingBillId, setMarkingBillId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'cash' | 'bank_transfer' | 'other'>('upi');
  const [utrRef, setUtrRef] = useState('');

  const { data: pending, refetch: refetchPending } = trpc.payments.pendingVerification.useQuery();
  const { data: allPayments } = trpc.payments.list.useQuery({});
  const markPaid = trpc.payments.markPaid.useMutation();

  const pendingBills = trpc.billing.listBills.useQuery({ status: 'sent' });

  async function handleMarkPaid() {
    if (!markingBillId || !amount) return;
    try {
      await markPaid.mutateAsync({
        bill_id: markingBillId,
        amount_paid: parseFloat(amount),
        payment_method: method,
        upi_ref: utrRef || undefined,
      });
      toast.success('Payment recorded');
      setMarkingBillId(null);
      setAmount('');
      setUtrRef('');
      refetchPending();
      pendingBills.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Payments" />
      <main className="flex-1 p-6">
        <Tabs.Root defaultValue="pending">
          <Tabs.List className="flex gap-1 p-1 bg-slate-light rounded-lg w-fit mb-6">
            {['pending', 'all'].map((tab) => (
              <Tabs.Trigger
                key={tab}
                value={tab}
                className="px-4 py-1.5 rounded-md text-sm font-medium text-slate capitalize data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition"
              >
                {tab === 'pending' ? 'Pending Confirmation' : 'All Payments'}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="pending" className="space-y-3">
            {/* Unpaid bills awaiting marking */}
            {pendingBills.data?.map((bill) => (
              <Card key={bill.id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-navy">{bill.lease.tenant.full_name}</p>
                    <p className="text-sm text-slate">{bill.unit.unit_number} · {bill.unit.property.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="money text-navy text-lg">{formatCurrency(Number(bill.total_amount))}</p>
                    <StatusPill status={bill.status} />
                  </div>
                  <Button
                    size="sm"
                    variant="sage"
                    onClick={() => { setMarkingBillId(bill.id); setAmount(String(Number(bill.total_amount))); }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Paid
                  </Button>
                </div>
              </Card>
            ))}
            {pendingBills.data?.length === 0 && (
              <EmptyState icon={CreditCard} title="No pending bills" description="All bills have been settled" />
            )}
          </Tabs.Content>

          <Tabs.Content value="all">
            {allPayments && allPayments.length > 0 ? (
              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Tenant</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Unit</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Amount</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Method</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">UTR</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPayments.map((payment) => (
                        <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-bg">
                          <td className="px-5 py-3.5 font-medium text-navy">{payment.bill.lease.tenant.full_name}</td>
                          <td className="px-5 py-3.5 text-slate">{payment.bill.unit.unit_number}</td>
                          <td className="px-5 py-3.5 money text-sage">{formatCurrency(Number(payment.amount_paid))}</td>
                          <td className="px-5 py-3.5 text-slate capitalize">{payment.payment_method}</td>
                          <td className="px-5 py-3.5 reading text-slate text-xs">{payment.upi_ref ?? '—'}</td>
                          <td className="px-5 py-3.5 text-slate text-xs">{formatDateTime(payment.paid_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <EmptyState icon={CreditCard} title="No payments recorded yet" />
            )}
          </Tabs.Content>
        </Tabs.Root>
      </main>

      <Modal open={!!markingBillId} onClose={() => setMarkingBillId(null)} title="Record Payment">
        <div className="space-y-4">
          <Input label="Amount Paid (₹)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select
            label="Payment Method"
            value={method}
            onValueChange={(v) => setMethod(v as typeof method)}
            options={[
              { value: 'upi', label: 'UPI' },
              { value: 'cash', label: 'Cash' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'other', label: 'Other' },
            ]}
          />
          {method === 'upi' && (
            <Input label="UTR / Transaction Reference" placeholder="12-digit UTR" value={utrRef} onChange={(e) => setUtrRef(e.target.value)} />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setMarkingBillId(null)}>Cancel</Button>
            <Button variant="sage" onClick={handleMarkPaid} loading={markPaid.isLoading}>Confirm Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
