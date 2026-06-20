'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Users, Phone } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { TenantForm } from '@/components/tenants/TenantForm';

export default function TenantsPage() {
  const [showNew, setShowNew] = useState(false);
  const { data: tenants, isLoading, refetch } = trpc.tenants.list.useQuery({ status: 'all' });

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Tenants"
        action={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />
            Add Tenant
          </Button>
        }
      />
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />)}
          </div>
        )}

        {!isLoading && tenants?.length === 0 && (
          <EmptyState
            icon={Users}
            title="No tenants yet"
            description="Add tenants and create leases to get started"
            action={<Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4" />Add Tenant</Button>}
          />
        )}

        {!isLoading && tenants && tenants.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => {
              const activeLease = tenant.leases.find((l) => l.status === 'active');
              return (
                <Link key={tenant.id} href={`/dashboard/tenants/${tenant.id}`}>
                  <Card className="hover:shadow-md transition cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-saffron-light flex items-center justify-center shrink-0">
                        <span className="text-saffron font-bold text-sm">
                          {tenant.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-navy truncate">{tenant.full_name}</h3>
                        <p className="text-sm text-slate flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />{tenant.phone}
                        </p>
                        {activeLease && (
                          <p className="text-xs text-slate mt-1">
                            {activeLease.unit.unit_number} · {activeLease.unit.property.name}
                          </p>
                        )}
                      </div>
                      <StatusPill status={activeLease ? 'active' : 'expired'} />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Add Tenant">
        <TenantForm onSuccess={() => { setShowNew(false); refetch(); }} />
      </Modal>
    </div>
  );
}
