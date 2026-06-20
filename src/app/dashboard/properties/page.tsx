'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Building2, MapPin } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PropertyForm } from '@/components/properties/PropertyForm';

export default function PropertiesPage() {
  const [showNew, setShowNew] = useState(false);
  const { data: properties, isLoading, refetch } = trpc.properties.list.useQuery();

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Properties"
        action={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />
            Add Property
          </Button>
        }
      />
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-44 rounded-xl bg-surface border border-border animate-pulse" />)}
          </div>
        )}

        {!isLoading && properties?.length === 0 && (
          <EmptyState
            icon={Building2}
            title="No properties yet"
            description="Add your first property to start managing units and tenants"
            action={<Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4" />Add Property</Button>}
          />
        )}

        {!isLoading && properties && properties.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((property) => {
              const totalUnits = property.units.length;
              const occupied = property.units.filter((u) => u.status === 'occupied').length;
              const rate = property.rates[0];

              return (
                <Link key={property.id} href={`/dashboard/properties/${property.id}`}>
                  <Card className="hover:shadow-md transition cursor-pointer h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-saffron-light flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-saffron" />
                      </div>
                      <StatusPill status={occupied < totalUnits ? 'vacant' : 'occupied'} />
                    </div>
                    <h3 className="font-semibold text-navy text-base mb-1">{property.name}</h3>
                    <p className="text-sm text-slate flex items-center gap-1 mb-3">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {property.city}, {property.state}
                    </p>
                    <div className="flex items-center gap-4 text-sm border-t border-border pt-3 mt-auto">
                      <span className="text-slate">{occupied}/{totalUnits} occupied</span>
                      {rate && (
                        <span className="text-slate">₹{Number(rate.elec_rate_per_unit)}/unit elec</span>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Add Property">
        <PropertyForm onSuccess={() => { setShowNew(false); refetch(); }} />
      </Modal>
    </div>
  );
}
