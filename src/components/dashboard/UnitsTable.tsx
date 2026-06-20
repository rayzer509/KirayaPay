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
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Rent Due</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Bill</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const lease = unit.leases[0];
                const latestBill = lease?.bills[0];
                const totalPaid = latestBill?.payments.reduce((s, p) => s + Number(p.amount_paid), 0) ?? 0;

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
                      {latestBill ? (
                        <div>
                          <span className="money text-navy">{formatCurrency(Number(latestBill.total_amount))}</span>
                          {totalPaid > 0 && (
                            <p className="text-xs text-slate">Paid: {formatCurrency(totalPaid)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate text-xs">No bill</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={latestBill?.status ?? unit.status} />
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
