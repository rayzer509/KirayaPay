'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FileText } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { LeaseForm } from '@/components/leases/LeaseForm';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function LeasesPage() {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const { data: leases, isLoading, refetch } = trpc.leases.list.useQuery({ status: 'active' });

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Leases"
        action={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />
            New Lease
          </Button>
        }
      />
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />)}
          </div>
        )}

        {!isLoading && leases?.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No active leases"
            description="Create a lease to assign a tenant to a unit"
            action={<Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4" />New Lease</Button>}
          />
        )}

        {!isLoading && leases && leases.length > 0 && (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Tenant</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Unit</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Rent</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Period</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Load</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leases.map((lease) => (
                    <tr
                      key={lease.id}
                      className="border-b border-border last:border-0 hover:bg-bg transition cursor-pointer"
                      onClick={() => router.push(`/dashboard/leases/${lease.id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/tenants/${lease.tenant_id}`} className="font-medium text-navy hover:text-saffron">
                          {lease.tenant.full_name}
                        </Link>
                        <p className="text-xs text-slate">{lease.tenant.phone}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-navy">{lease.unit.unit_number}</p>
                        <p className="text-xs text-slate">{lease.unit.property.name}</p>
                      </td>
                      <td className="px-5 py-3.5 money text-navy">{formatCurrency(Number(lease.monthly_rent))}</td>
                      <td className="px-5 py-3.5 text-slate text-xs">
                        {formatDate(lease.start_date)} — {formatDate(lease.end_date)}
                      </td>
                      <td className="px-5 py-3.5 reading text-navy">{Number(lease.sanctioned_load_kw)} kW</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <StatusPill status={lease.status} />
                          {!lease.acknowledged_at && (
                            <span className="text-xs text-coral">Not acknowledged</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Create Lease" size="lg">
        <LeaseForm onSuccess={() => { setShowNew(false); refetch(); }} />
      </Modal>
    </div>
  );
}
