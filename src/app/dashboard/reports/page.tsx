'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatMonth } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ReportsPage() {
  const [selectedProperty, setSelectedProperty] = useState('');

  const { data: properties } = trpc.properties.list.useQuery();
  const { data: cycles } = trpc.billing.listCycles.useQuery(
    { property_id: selectedProperty },
    { enabled: !!selectedProperty }
  );

  const propertyOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  const monthlyData = cycles?.map((cycle) => {
    const totalBilled = cycle.bills.reduce((s, b) => s + Number(b.total_amount), 0);
    const totalPaid = cycle.bills.reduce(
      (s, b) => s + b.payments.reduce((ps, p) => ps + Number(p.amount_paid), 0),
      0
    );
    return {
      month: formatMonth(cycle.cycle_month),
      billed: totalBilled,
      paid: totalPaid,
      outstanding: totalBilled - totalPaid,
      bills: cycle.bills.length,
    };
  }) ?? [];

  const totalBilled = monthlyData.reduce((s, m) => s + m.billed, 0);
  const totalPaid = monthlyData.reduce((s, m) => s + m.paid, 0);

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Reports" />
      <main className="flex-1 p-6 space-y-6">
        <Select
          value={selectedProperty}
          onValueChange={setSelectedProperty}
          options={propertyOptions}
          placeholder="Select property…"
          className="max-w-xs"
        />

        {!selectedProperty && (
          <EmptyState icon={BarChart3} title="Select a property" description="Choose a property to view collection and billing reports" />
        )}

        {selectedProperty && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <p className="text-xs text-slate uppercase tracking-wide mb-1">Total Billed (All Time)</p>
                <p className="text-2xl font-bold money text-navy">{formatCurrency(totalBilled)}</p>
              </Card>
              <Card>
                <p className="text-xs text-slate uppercase tracking-wide mb-1">Total Collected</p>
                <p className="text-2xl font-bold money text-sage">{formatCurrency(totalPaid)}</p>
              </Card>
              <Card>
                <p className="text-xs text-slate uppercase tracking-wide mb-1">Total Outstanding</p>
                <p className="text-2xl font-bold money text-coral">{formatCurrency(totalBilled - totalPaid)}</p>
              </Card>
            </div>

            {/* Monthly breakdown */}
            {monthlyData.length > 0 ? (
              <Card padding="none">
                <CardHeader className="px-5 pt-5">
                  <CardTitle>Monthly Collection Summary</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Month</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Bills</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Billed</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Collected</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Outstanding</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((row) => (
                        <tr key={row.month} className="border-b border-border last:border-0 hover:bg-bg">
                          <td className="px-5 py-3.5 font-medium text-navy">{row.month}</td>
                          <td className="px-5 py-3.5 text-slate">{row.bills}</td>
                          <td className="px-5 py-3.5 money text-navy">{formatCurrency(row.billed)}</td>
                          <td className="px-5 py-3.5 money text-sage">{formatCurrency(row.paid)}</td>
                          <td className="px-5 py-3.5 money text-coral">{formatCurrency(row.outstanding)}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 bg-slate-light rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-sage rounded-full"
                                  style={{ width: row.billed > 0 ? `${Math.min((row.paid / row.billed) * 100, 100)}%` : '0%' }}
                                />
                              </div>
                              <span className="text-xs money text-slate">
                                {row.billed > 0 ? `${((row.paid / row.billed) * 100).toFixed(0)}%` : '—'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <EmptyState icon={BarChart3} title="No billing data yet" description="Billing cycles will appear here once created" />
            )}
          </>
        )}
      </main>
    </div>
  );
}
