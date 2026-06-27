'use client';

import { trpc } from '@/lib/trpc';
import { TenantLedger } from '@/components/tenant/TenantLedger';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import * as Tabs from '@radix-ui/react-tabs';
import { History, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

export default function TenantBillsPage() {
  const { data: me }          = trpc.auth.me.useQuery();
  const { data: historyData } = trpc.billing.paymentHistory.useQuery();
  const { data: activeLease } = trpc.leases.myActiveLease.useQuery();
  const { data: charges }     = trpc.billing.myCharges.useQuery();

  // Build chronological statement: charges (debits) + confirmed payments (credits)
  const statementRows = (() => {
    if (!charges || !historyData) return null;
    const chargeEntries = charges.map((c) => ({
      date:        new Date(c.issue_date ?? c.created_at),
      description: c.title,
      debit:       Number(c.amount),
      credit:      0,
    }));
    const paymentEntries = historyData.payments.map((p) => ({
      date:        new Date(p.paid_at),
      description: `Payment · ${p.payment_method.replace(/_/g, ' ')}${p.upi_ref ? ` · UTR ${p.upi_ref}` : ''}`,
      debit:       0,
      credit:      Number(p.amount_paid),
    }));
    const all = [...chargeEntries, ...paymentEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
    let balance = 0;
    return all.map((e) => {
      balance = Math.round((balance + e.debit - e.credit) * 100) / 100;
      return { ...e, balance: Math.max(0, balance) };
    });
  })();

  return (
    <div className="lg:ml-48 p-4 lg:p-6 space-y-4 max-w-2xl">
      {me && (
        <div className="mb-2">
          <h1 className="text-lg font-bold text-navy">Hi, {me.full_name.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate">Your account ledger and payment status</p>
        </div>
      )}

      <Tabs.Root defaultValue="ledger">
        <Tabs.List className="flex gap-1 p-1 bg-slate-light rounded-lg w-fit mb-4">
          <Tabs.Trigger
            value="ledger"
            className="px-4 py-1.5 rounded-md text-sm font-medium text-slate data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" /> Ledger
          </Tabs.Trigger>
          <Tabs.Trigger
            value="statement"
            className="px-4 py-1.5 rounded-md text-sm font-medium text-slate data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" /> Statement
          </Tabs.Trigger>
        </Tabs.List>

        {/* ── Ledger tab ───────────────────────────────────────────── */}
        <Tabs.Content value="ledger">
          {activeLease ? (
            <TenantLedger
              leaseId={activeLease.id}
              upiId={activeLease.unit.property.upi_id}
            />
          ) : (
            <div className="p-8 text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="font-semibold text-navy">No active lease found</p>
              <p className="text-sm text-slate">Contact your landlord if you believe this is an error</p>
            </div>
          )}
        </Tabs.Content>

        {/* ── Statement tab — full transaction history ─────────────── */}
        <Tabs.Content value="statement">
          {/* FY summary */}
          {historyData && (
            <Card className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Total Paid This Financial Year</p>
                  <p className="text-lg font-bold text-navy money">{formatCurrency(historyData.totalThisFY)}</p>
                </div>
                <p className="text-xs text-slate">
                  Apr {new Date(historyData.fyStart).getFullYear()} – Mar {new Date(historyData.fyStart).getFullYear() + 1}
                </p>
              </div>
            </Card>
          )}

          {/* Statement table */}
          {statementRows === null ? (
            <div className="h-40 rounded-xl bg-surface border border-border animate-pulse" />
          ) : statementRows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="font-semibold text-navy">No transactions yet</p>
              <p className="text-sm text-slate">Charges and payments will appear here</p>
            </div>
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide whitespace-nowrap">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Description</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-coral uppercase tracking-wide whitespace-nowrap">Charges</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-sage uppercase tracking-wide whitespace-nowrap">Payments</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide whitespace-nowrap">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementRows.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-bg transition">
                        <td className="px-4 py-3 text-slate whitespace-nowrap">{format(row.date, 'dd MMM yyyy')}</td>
                        <td className="px-4 py-3 text-navy">{row.description}</td>
                        <td className="px-4 py-3 text-right money text-coral">{row.debit > 0 ? formatCurrency(row.debit) : <span className="text-slate">—</span>}</td>
                        <td className="px-4 py-3 text-right money text-sage">{row.credit > 0 ? formatCurrency(row.credit) : <span className="text-slate">—</span>}</td>
                        <td className={`px-4 py-3 text-right money font-semibold ${row.balance > 0 ? 'text-coral' : 'text-sage'}`}>
                          {formatCurrency(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
