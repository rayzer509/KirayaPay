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
import { CreditCard, CheckCircle2, ClipboardList, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import toast from 'react-hot-toast';

export default function PaymentsPage() {
  const [markingBillId, setMarkingBillId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'cash' | 'bank_transfer' | 'other'>('upi');
  const [utrRef, setUtrRef] = useState('');

  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: tenantSubmissions, refetch: refetchSubmissions } = trpc.payments.pendingVerification.useQuery();
  const { data: allPayments, refetch: refetchAll } = trpc.payments.list.useQuery({});
  const pendingBills = trpc.billing.listBills.useQuery({ status: 'sent' });

  const confirmPayment = trpc.payments.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success('Payment confirmed');
      refetchSubmissions();
      pendingBills.refetch();
      refetchAll();
    },
    onError: (err) => toast.error(err.message ?? 'Failed to confirm'),
  });

  const rejectPayment = trpc.payments.rejectPayment.useMutation({
    onSuccess: () => {
      toast.success('Payment rejected — tenant will need to resubmit');
      setRejectingPaymentId(null);
      setRejectionReason('');
      refetchSubmissions();
      pendingBills.refetch();
      refetchAll();
    },
    onError: (err) => toast.error(err.message ?? 'Failed to reject'),
  });

  const markPaid = trpc.payments.markPaid.useMutation();

  // Bills where the tenant already submitted a payment — don't show in manual section
  const submittedBillIds = new Set(tenantSubmissions?.map((p) => p.bill_id) ?? []);
  const unsubmittedBills = pendingBills.data?.filter((b) => !submittedBillIds.has(b.id)) ?? [];

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
      pendingBills.refetch();
      refetchAll();
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

          <Tabs.Content value="pending" className="space-y-6">
            {/* Section 1: Tenant-submitted payments awaiting landlord confirmation */}
            <div>
              <h3 className="text-sm font-semibold text-slate uppercase tracking-wide mb-3">
                Tenant Submissions
              </h3>
              {tenantSubmissions && tenantSubmissions.length > 0 ? (
                <div className="space-y-3">
                  {tenantSubmissions.map((payment) => (
                    <Card key={payment.id}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1">
                          <p className="font-semibold text-navy">
                            {payment.bill.lease.tenant.full_name}
                          </p>
                          <p className="text-sm text-slate">
                            {payment.bill.unit.unit_number} · {payment.bill.unit.property.name}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-light text-slate capitalize">
                              {payment.payment_method === 'upi' ? 'UPI' : 'Cash'}
                            </span>
                            {payment.upi_ref && (
                              <span className="text-xs reading bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-mono">
                                UTR: {payment.upi_ref}
                              </span>
                            )}
                            {payment.note && (
                              <span className="text-xs text-slate italic">{payment.note}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="money text-navy text-lg">
                              {formatCurrency(Number(payment.amount_paid))}
                            </p>
                            <p className="text-xs text-slate">
                              {formatDateTime(payment.paid_at)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="sage"
                            loading={confirmPayment.isLoading}
                            onClick={() => confirmPayment.mutate({ payment_id: payment.id })}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => { setRejectingPaymentId(payment.id); setRejectionReason(''); }}
                          >
                            <XCircle className="w-4 h-4 text-coral" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate italic">No pending tenant submissions</p>
              )}
            </div>

            {/* Section 2: Bills with no tenant submission — manual recording */}
            <div>
              <h3 className="text-sm font-semibold text-slate uppercase tracking-wide mb-3">
                Record Offline Payment
              </h3>
              {unsubmittedBills.length > 0 ? (
                <div className="space-y-3">
                  {unsubmittedBills.map((bill) => (
                    <Card key={bill.id}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-navy">{bill.lease.tenant.full_name}</p>
                          <p className="text-sm text-slate">
                            {bill.unit.unit_number} · {bill.unit.property.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="money text-navy text-lg">
                            {formatCurrency(Number(bill.total_amount))}
                          </p>
                          <StatusPill status={bill.status} />
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setMarkingBillId(bill.id);
                            setAmount(String(Number(bill.total_amount)));
                          }}
                        >
                          <ClipboardList className="w-4 h-4" />
                          Record
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate italic">No unpaid bills</p>
              )}
            </div>
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
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPayments.map((payment) => {
                        const s = payment.status;
                        return (
                          <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-bg">
                            <td className="px-5 py-3.5 font-medium text-navy">{payment.bill.lease.tenant.full_name}</td>
                            <td className="px-5 py-3.5 text-slate">{payment.bill.unit.unit_number}</td>
                            <td className="px-5 py-3.5 money text-sage">{formatCurrency(Number(payment.amount_paid))}</td>
                            <td className="px-5 py-3.5 text-slate capitalize">{payment.payment_method}</td>
                            <td className="px-5 py-3.5 reading text-slate text-xs">{payment.upi_ref ?? '—'}</td>
                            <td className="px-5 py-3.5">
                              {s === 'submitted' && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Pending</span>}
                              {s === 'confirmed' && <span className="text-xs px-2 py-0.5 rounded-full bg-sage-light text-sage">Confirmed</span>}
                              {s === 'rejected' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-coral/10 text-coral" title={payment.rejection_reason ?? ''}>
                                  Rejected
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-slate text-xs">{formatDateTime(payment.paid_at)}</td>
                          </tr>
                        );
                      })}
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

      <Modal
        open={!!rejectingPaymentId}
        onClose={() => { setRejectingPaymentId(null); setRejectionReason(''); }}
        title="Reject Payment"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate">
            The tenant will be notified that their payment was not verified and will need to resubmit.
          </p>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Reason for rejection</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. UTR not found in bank statement, amount mismatch…"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setRejectingPaymentId(null); setRejectionReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              className="border-coral text-coral hover:bg-coral/10"
              disabled={!rejectionReason.trim()}
              loading={rejectPayment.isLoading}
              onClick={() => rejectPayment.mutate({ payment_id: rejectingPaymentId!, rejection_reason: rejectionReason.trim() })}
            >
              <XCircle className="w-4 h-4" />
              Reject Payment
            </Button>
          </div>
        </div>
      </Modal>

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
