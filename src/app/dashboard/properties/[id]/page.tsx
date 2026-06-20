'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft, Edit, Zap } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Modal } from '@/components/ui/Modal';
import { UnitForm } from '@/components/properties/UnitForm';
import { RateForm } from '@/components/properties/RateForm';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [showRateForm, setShowRateForm] = useState(false);

  const { data: property, isLoading, refetch } = trpc.properties.get.useQuery({ id });

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-slate">Loading…</div>;
  if (!property) return <div className="flex-1 flex items-center justify-center text-slate">Property not found</div>;

  const currentRate = property.rates[0];

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title={property.name}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowRateForm(true)}>
              <Zap className="w-4 h-4" />
              Set Rates
            </Button>
            <Button onClick={() => setShowUnitForm(true)}>
              <Plus className="w-4 h-4" />
              Add Unit
            </Button>
          </div>
        }
      />
      <main className="flex-1 p-6 space-y-6">
        <Link href="/dashboard/properties" className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-navy transition">
          <ArrowLeft className="w-4 h-4" />
          All Properties
        </Link>

        {/* Property Info + Current Rates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Property Details</CardTitle></CardHeader>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate">Address</dt><dd className="text-navy font-medium text-right max-w-xs">{property.address}</dd></div>
              <div className="flex justify-between"><dt className="text-slate">City</dt><dd className="text-navy font-medium">{property.city}</dd></div>
              <div className="flex justify-between"><dt className="text-slate">State</dt><dd className="text-navy font-medium">{property.state}</dd></div>
              {property.upi_id && <div className="flex justify-between"><dt className="text-slate">UPI ID</dt><dd className="text-navy font-medium money">{property.upi_id}</dd></div>}
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Rates</CardTitle>
              <button onClick={() => setShowRateForm(true)} className="p-1.5 rounded-lg hover:bg-slate-light text-slate hover:text-navy transition">
                <Edit className="w-4 h-4" />
              </button>
            </CardHeader>
            {currentRate ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate">Base charge / kW / month</dt><dd className="money text-navy">{formatCurrency(Number(currentRate.base_rate_per_kw))}</dd></div>
                <div className="flex justify-between"><dt className="text-slate">Electricity rate / unit</dt><dd className="money text-navy">{formatCurrency(Number(currentRate.elec_rate_per_unit))}</dd></div>
                <div className="flex justify-between"><dt className="text-slate">Water rate / kL</dt><dd className="money text-navy">{formatCurrency(Number(currentRate.water_rate_per_kl))}</dd></div>
                <div className="flex justify-between"><dt className="text-slate">Effective from</dt><dd className="text-navy">{formatDate(currentRate.effective_from)}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-slate">No rates set yet. <button onClick={() => setShowRateForm(true)} className="text-saffron hover:underline">Set rates →</button></p>
            )}
          </Card>
        </div>

        {/* Units */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Units ({property.units.length})</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Unit</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Floor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Area</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Tenant</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Load</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {property.units.map((unit) => {
                  const activeLease = unit.leases[0];
                  return (
                    <tr key={unit.id} className="border-b border-border last:border-0 hover:bg-bg transition">
                      <td className="px-5 py-3.5 font-medium text-navy">{unit.unit_number}</td>
                      <td className="px-5 py-3.5 text-slate">{unit.floor ?? '—'}</td>
                      <td className="px-5 py-3.5 text-slate">{unit.area_sqft ? `${unit.area_sqft} sqft` : '—'}</td>
                      <td className="px-5 py-3.5">
                        {activeLease ? (
                          <div>
                            <p className="font-medium text-navy">{activeLease.tenant.full_name}</p>
                            <p className="text-xs text-slate">{activeLease.tenant.phone}</p>
                          </div>
                        ) : <span className="text-slate">—</span>}
                      </td>
                      <td className="px-5 py-3.5 reading text-navy">
                        {activeLease ? `${activeLease.sanctioned_load_kw} kW` : '—'}
                      </td>
                      <td className="px-5 py-3.5"><StatusPill status={unit.status} /></td>
                    </tr>
                  );
                })}
                {property.units.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate text-sm">No units yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      <Modal open={showUnitForm} onClose={() => setShowUnitForm(false)} title="Add Unit">
        <UnitForm propertyId={id} onSuccess={() => { setShowUnitForm(false); refetch(); }} />
      </Modal>

      <Modal open={showRateForm} onClose={() => setShowRateForm(false)} title="Set Utility Rates">
        <RateForm propertyId={id} currentRate={currentRate ? {
          base_rate_per_kw: Number(currentRate.base_rate_per_kw),
          elec_rate_per_unit: Number(currentRate.elec_rate_per_unit),
          water_rate_per_kl: Number(currentRate.water_rate_per_kl),
        } : undefined} onSuccess={() => { setShowRateForm(false); refetch(); }} />
      </Modal>
    </div>
  );
}
