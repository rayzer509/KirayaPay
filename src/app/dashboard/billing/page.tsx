'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Zap } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { formatMonth, formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { format, addDays } from 'date-fns';

export default function BillingPage() {
  const [selectedProperty, setSelectedProperty] = useState('');
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [cycleMonth, setCycleMonth] = useState(format(new Date(), 'yyyy-MM-01'));
  const [readingsDue, setReadingsDue] = useState(format(addDays(new Date(), 5), 'yyyy-MM-dd'));

  const { data: properties } = trpc.properties.list.useQuery();
  const { data: cycles, isLoading, refetch } = trpc.billing.listCycles.useQuery(
    { property_id: selectedProperty },
    { enabled: !!selectedProperty }
  );

  const createCycle = trpc.billing.createCycle.useMutation();

  const propertyOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  async function handleCreateCycle() {
    if (!selectedProperty) return toast.error('Select a property first');
    try {
      await createCycle.mutateAsync({
        property_id: selectedProperty,
        cycle_month: cycleMonth,
        readings_due_by: readingsDue,
      });
      toast.success('Billing cycle created');
      setShowNewCycle(false);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create cycle');
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Billing"
        action={
          <Button onClick={() => setShowNewCycle(true)} disabled={!selectedProperty}>
            <Plus className="w-4 h-4" />
            New Cycle
          </Button>
        }
      />
      <main className="flex-1 p-6 space-y-4">
        <Select
          label="Select Property"
          value={selectedProperty}
          onValueChange={setSelectedProperty}
          options={propertyOptions}
          placeholder="Choose a property…"
          className="max-w-xs"
        />

        {!selectedProperty && (
          <EmptyState icon={Zap} title="Select a property" description="Choose a property above to view and manage billing cycles" />
        )}

        {selectedProperty && isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />)}
          </div>
        )}

        {selectedProperty && !isLoading && cycles?.length === 0 && (
          <EmptyState
            icon={Zap}
            title="No billing cycles"
            description="Create a billing cycle to start entering meter readings"
            action={<Button onClick={() => setShowNewCycle(true)}><Plus className="w-4 h-4" />New Cycle</Button>}
          />
        )}

        {selectedProperty && !isLoading && cycles && cycles.length > 0 && (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Month</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Readings</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Bills</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Due by</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle) => (
                    <tr key={cycle.id} className="border-b border-border last:border-0 hover:bg-bg transition">
                      <td className="px-5 py-3.5 font-medium text-navy">{formatMonth(cycle.cycle_month)}</td>
                      <td className="px-5 py-3.5 text-slate">{cycle.meter_readings.length} entered</td>
                      <td className="px-5 py-3.5 text-slate">{cycle.bills.length} bills</td>
                      <td className="px-5 py-3.5"><StatusPill status={cycle.status} /></td>
                      <td className="px-5 py-3.5 text-slate text-xs">{formatDate(cycle.readings_due_by)}</td>
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/billing/${cycle.id}`} className="text-saffron hover:underline text-xs font-medium">
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      <Modal open={showNewCycle} onClose={() => setShowNewCycle(false)} title="New Billing Cycle">
        <div className="space-y-4">
          <Input label="Cycle Month" type="month" value={format(new Date(cycleMonth), 'yyyy-MM')} onChange={(e) => setCycleMonth(`${e.target.value}-01`)} />
          <Input label="Readings Due By" type="date" value={readingsDue} onChange={(e) => setReadingsDue(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNewCycle(false)}>Cancel</Button>
            <Button onClick={handleCreateCycle} loading={createCycle.isLoading}>Create Cycle</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
