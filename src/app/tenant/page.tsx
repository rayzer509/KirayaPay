'use client';

import { trpc } from '@/lib/trpc';
import { StatusPill } from '@/components/ui/StatusPill';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { UPIPayment } from '@/components/tenant/UPIPayment';
import { CashPayment } from '@/components/tenant/CashPayment';
import { downloadReceipt } from '@/lib/receipt';
import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import Link from 'next/link';
import { Download, History } from 'lucide-react';
import { format } from 'date-fns';

export default function TenantBillsPage() {
  const [payingBillId, setPayingBillId] = useState<string | null>(null);

  const { data: bills, isLoading, refetch } = trpc.billing.billsForTenant.useQuery({ status: 'all' });
  const { data: me } = trpc.auth.me.useQuery();
  const { data: historyData } = trpc.billing.paymentHistory.useQuery();

  const pendingBills = bills?.filter((b) => b.status === 'sent' || b.status === 'partial' || b.status === 'overdue') ?? [];
  const paidBills = bills?.filter((b) => b.status === 'paid') ?? [];

  const payingBill = bills?.find((b) => b.id === payingBillId);

  return (
    <div className="lg:ml-48 p-4 lg:p-6 space-y-4 max-w-2xl">
      {me && (
        <div className="mb-2">
          <h1 className="text-lg font-bold text-navy">Hi, {me.full_name.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate">Here are your bills and payment status</p>
        </div>
      )}

      <Tabs.Root defaultValue="pending">
        <Tabs.List className="flex gap-1 p-1 bg-slate-light rounded-lg w-fit mb-4">
          <Tabs.Trigger value="pending" className="px-4 py-1.5 rounded-md text-sm font-medium text-slate data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition">
            Due ({pendingBills.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="paid" className="px-4 py-1.5 rounded-md text-sm font-medium text-slate data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition">
            Paid ({paidBills.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="history" className="px-4 py-1.5 rounded-md text-sm font-medium text-slate data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition flex items-center gap-1">
            <History className="w-3.5 h-3.5" /> History
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="pending" className="space-y-3">
          {isLoading && <div className="h-32 rounded-xl bg-surface border border-border animate-pulse" />}
          {!isLoading && pendingBills.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="font-semibold text-navy">You're all clear!</p>
              <p className="text-sm text-slate">No pending bills</p>
            </div>
          )}
          {pendingBills.map((bill) => {
            const totalPaid = bill.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
            const outstanding = Number(bill.total_amount) - totalPaid;
            return (
              <Card key={bill.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-navy">{bill.unit.unit_number} · {bill.unit.property.name}</p>
                    <p className="text-xs text-slate">{bill.cycle.cycle_month ? `${new Date(bill.cycle.cycle_month).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}` : ''}</p>
                  </div>
                  <StatusPill status={bill.status} />
                </div>

                <div className="space-y-1.5 mb-3">
                  {bill.line_items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-slate">{item.description}</span>
                      <span className="money text-navy">{formatCurrency(Number(item.amount))}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-1.5 flex justify-between">
                    <span className="font-semibold text-navy">Total</span>
                    <span className="money font-bold text-navy">{formatCurrency(Number(bill.total_amount))}</span>
                  </div>
                  {totalPaid > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-sage">Paid</span>
                      <span className="money text-sage">{formatCurrency(totalPaid)}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate mb-3">Due: {formatDate(bill.due_date)}</p>

                <button
                  onClick={() => setPayingBillId(bill.id)}
                  className="w-full py-2.5 rounded-lg bg-saffron hover:bg-saffron/90 text-white font-semibold text-sm transition"
                >
                  Pay {formatCurrency(outstanding)}
                </button>
              </Card>
            );
          })}
        </Tabs.Content>

        <Tabs.Content value="paid" className="space-y-3">
          {paidBills.map((bill) => {
            const lastPayment = bill.payments[bill.payments.length - 1];
            return (
              <Card key={bill.id} className="opacity-80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-navy">{bill.unit.unit_number} · {bill.unit.property.name}</p>
                    <p className="text-xs text-slate">{new Date(bill.cycle.cycle_month).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="money font-bold text-sage">{formatCurrency(Number(bill.total_amount))}</p>
                    <StatusPill status="paid" />
                    {lastPayment && me && (
                      <button
                        onClick={() => downloadReceipt({
                          paymentId: lastPayment.id,
                          paidAt: lastPayment.paid_at,
                          tenant: { full_name: me.full_name, phone: me.phone ?? me.email ?? '' },
                          property: bill.unit.property,
                          unit: bill.unit,
                          cycleMonth: bill.cycle.cycle_month,
                          lineItems: bill.line_items.map((li) => ({ description: li.description, amount: li.amount })),
                          totalAmount: bill.total_amount,
                          amountPaid: lastPayment.amount_paid,
                          paymentMethod: lastPayment.payment_method,
                          upiRef: lastPayment.upi_ref,
                        })}
                        className="flex items-center gap-1 text-xs text-slate hover:text-navy transition mt-0.5"
                      >
                        <Download className="w-3 h-3" />
                        Receipt
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </Tabs.Content>

        <Tabs.Content value="history" className="space-y-3">
          {historyData && (
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Total Paid This Financial Year</p>
                  <p className="text-lg font-bold text-navy money">{formatCurrency(historyData.totalThisFY)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate">Apr {new Date(historyData.fyStart).getFullYear()} – Mar {new Date(historyData.fyStart).getFullYear() + 1}</p>
                </div>
              </div>
            </Card>
          )}
          {!historyData?.payments?.length && (
            <div className="p-8 text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="font-semibold text-navy">No payments yet</p>
              <p className="text-sm text-slate">Your payment history will appear here</p>
            </div>
          )}
          {historyData?.payments?.map((payment) => (
            <Card key={payment.id} className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy money">{formatCurrency(Number(payment.amount_paid))}</p>
                  <p className="text-xs text-slate mt-0.5">
                    {payment.bill.cycle?.cycle_month
                      ? new Date(payment.bill.cycle.cycle_month).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
                      : '—'}
                    {' · '}
                    <span className="capitalize">{payment.payment_method.replace('_', ' ')}</span>
                    {payment.upi_ref && ` · ${payment.upi_ref}`}
                  </p>
                </div>
                <p className="text-xs text-slate">{format(new Date(payment.paid_at), 'dd MMM yyyy')}</p>
              </div>
            </Card>
          ))}
        </Tabs.Content>
      </Tabs.Root>

      {/* Payment Modal */}
      {payingBill && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-sm">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-navy">Pay Bill</h2>
              <button onClick={() => setPayingBillId(null)} className="text-slate hover:text-navy text-xl">×</button>
            </div>

            <Tabs.Root defaultValue="upi" className="p-5">
              <Tabs.List className="flex gap-1 p-1 bg-slate-light rounded-lg mb-4">
                {['upi', 'cash'].map((tab) => (
                  <Tabs.Trigger
                    key={tab}
                    value={tab}
                    className="flex-1 py-1.5 rounded-md text-sm font-medium text-slate uppercase data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition"
                  >
                    {tab === 'upi' ? 'Pay via UPI' : 'Pay in Cash'}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <Tabs.Content value="upi">
                <UPIPayment
                  bill={payingBill}
                  onSuccess={() => { setPayingBillId(null); refetch(); }}
                />
              </Tabs.Content>

              <Tabs.Content value="cash">
                <CashPayment
                  bill={payingBill}
                  onSuccess={() => { setPayingBillId(null); refetch(); }}
                />
              </Tabs.Content>
            </Tabs.Root>
          </div>
        </div>
      )}
    </div>
  );
}
