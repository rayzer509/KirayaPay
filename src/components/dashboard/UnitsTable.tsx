import Link from 'next/link';
import { StatusPill } from '@/components/ui/StatusPill';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Building2 } from 'lucide-react';
import type { RouterOutputs } from '@/lib/trpc-types';

type UnitWithStatus = RouterOutputs['dashboard']['unitsWithStatus'][number];

export function UnitsTable({ units }: { units: UnitWithStatus[] }) {
  return (
    <Card padding="none">
      <CardHeader className="px-5 pt-5 pb-0">
        <CardTitle>Units Overview</CardTitle>
      </CardHeader>
      {units.length === 0 ? (
        <EmptyState icon={Building2} title="No units yet" description="Add a property and units to see them here" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Unit</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Tenant</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Monthly Rent</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Total Paid</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Outstanding</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const lease = unit.leases[0];

                // Ledger-accurate balance: total accrued charges minus confirmed payments
                const totalCharged   = lease?.charges.reduce((s, c) => s + Number(c.amount), 0) ?? 0;
                const totalConfirmed = lease?.payments.reduce((s, p) => s + Number(p.amount_paid), 0) ?? 0;
                const outstanding    = Math.max(0, totalCharged - totalConfirmed);

                const lastPayment    = lease?.payments[0]; // already sorted desc by paid_at

                return (
                  <tr key={unit.id} className="border-b border-border last:border-0 hover:bg-bg transition">
                    <td className="px-5 py-3.5">
                      <Link href={`/dashboard/properties/${unit.property_id}`} className="font-medium text-navy hover:text-saffron">
                        {unit.unit_number}
                      </Link>
                      <p className="text-xs text-slate">{unit.property.name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {lease ? (
                        <div>
                          <p className="font-medium text-navy">{lease.tenant.full_name}</p>
                          <p className="text-xs text-slate">{lease.tenant.phone}</p>
                        </div>
                      ) : (
                        <span className="text-slate text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {lease ? (
                        <span className="money text-navy">{formatCurrency(lease.monthly_rent as unknown as number)}</span>
                      ) : (
                        <span className="text-slate text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {lease ? (
                        <div>
                          <span className="money text-sage">{formatCurrency(totalConfirmed)}</span>
                          {lastPayment && (
                            <p className="text-xs text-slate">Last: {formatDate(lastPayment.paid_at)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {lease ? (
                        <span className={`money font-semibold ${outstanding > 0 ? 'text-coral' : 'text-sage'}`}>
                          {formatCurrency(outstanding)}
                        </span>
                      ) : (
                        <span className="text-slate text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={outstanding > 0 ? 'sent' : lease ? 'paid' : unit.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
