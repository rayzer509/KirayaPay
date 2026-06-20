'use client';

import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

export default function UnitsPage() {
  const router = useRouter();
  const { data: units, isLoading } = trpc.units.listAll.useQuery();

  const vacant = units?.filter((u) => u.status === 'vacant').length ?? 0;
  const occupied = units?.filter((u) => u.status === 'occupied').length ?? 0;

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="All Units" subtitle={units ? `${occupied} occupied · ${vacant} vacant` : undefined} />

      <main className="flex-1 p-6">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />)}
          </div>
        )}

        {!isLoading && units?.length === 0 && (
          <EmptyState
            icon={Building2}
            title="No units yet"
            description="Add units from the Properties page"
            action={<button onClick={() => router.push('/dashboard/properties')} className="text-sm text-saffron hover:underline">Go to Properties</button>}
          />
        )}

        {!isLoading && units && units.length > 0 && (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Unit</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Property</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Tenant</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Rent</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Floor</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit) => {
                    const activeLease = unit.leases[0];
                    return (
                      <tr
                        key={unit.id}
                        className="border-b border-border last:border-0 hover:bg-bg transition cursor-pointer"
                        onClick={() => router.push(`/dashboard/properties/${unit.property_id}`)}
                      >
                        <td className="px-5 py-3.5 font-medium text-navy">{unit.unit_number}</td>
                        <td className="px-5 py-3.5 text-slate">{unit.property.name}</td>
                        <td className="px-5 py-3.5">
                          {activeLease ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/tenants/${activeLease.tenant_id}`); }}
                              className="text-navy hover:text-saffron font-medium transition"
                            >
                              {activeLease.tenant.full_name}
                            </button>
                          ) : (
                            <span className="text-slate text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 money text-navy">
                          {activeLease ? formatCurrency(Number(activeLease.monthly_rent)) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-slate">
                          {unit.floor != null ? `Floor ${unit.floor}` : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill status={unit.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
