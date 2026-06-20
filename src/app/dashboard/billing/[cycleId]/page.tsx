'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatMonth, formatCurrency } from '@/lib/utils';
import { MeterReadingForm } from '@/components/billing/MeterReadingForm';
import { Modal } from '@/components/ui/Modal';
import toast from 'react-hot-toast';

export default function BillingCyclePage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const router = useRouter();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  const { data: cycle, isLoading, refetch } = trpc.billing.getCycle.useQuery({ id: cycleId });
  const generateBills = trpc.billing.generateBills.useMutation();

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-slate">Loading…</div>;
  if (!cycle) return <div className="flex-1 flex items-center justify-center text-slate">Cycle not found</div>;

  const occupiedUnits = cycle.property.units.filter((u) => u.status === 'occupied');
  const readingMap = new Map(cycle.meter_readings.map((r) => [r.unit_id, r]));
  const allReadingsDone = occupiedUnits.length > 0 && occupiedUnits.every((u) => readingMap.has(u.id));
  const canGenerate = allReadingsDone && cycle.status !== 'bills_generated' && cycle.status !== 'closed';

  async function handleGenerate() {
    try {
      const bills = await generateBills.mutateAsync({ cycle_id: cycleId });
      toast.success(`${bills.length} bills generated and sent to tenants`);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate bills');
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title={`Billing — ${formatMonth(cycle.cycle_month)}`}
        action={
          canGenerate && (
            <Button onClick={handleGenerate} loading={generateBills.isLoading} variant="sage">
              <CheckCircle2 className="w-4 h-4" />
              Generate Bills
            </Button>
          )
        }
      />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/billing" className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-navy transition">
            <ArrowLeft className="w-4 h-4" />
            All Cycles
          </Link>
          <StatusPill status={cycle.status} />
        </div>

        {/* Readings progress */}
        <Card>
          <CardHeader>
            <CardTitle>Meter Readings ({readingMap.size}/{occupiedUnits.length} done)</CardTitle>
            <div className="h-2 w-48 bg-slate-light rounded-full overflow-hidden">
              <div
                className="h-full bg-saffron rounded-full transition-all"
                style={{ width: occupiedUnits.length > 0 ? `${(readingMap.size / occupiedUnits.length) * 100}%` : '0%' }}
              />
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {occupiedUnits.map((unit) => {
              const reading = readingMap.get(unit.id);
              const isDone = !!reading;

              return (
                <button
                  key={unit.id}
                  onClick={() => { setSelectedUnitId(unit.id); setSelectedUnit(unit.unit_number); }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-saffron hover:bg-saffron-light transition text-left"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDone ? 'bg-sage-light' : 'bg-coral-light'}`}>
                    {isDone
                      ? <CheckCircle2 className="w-4 h-4 text-sage" />
                      : <AlertTriangle className="w-4 h-4 text-coral" />
                    }
                  </div>
                  <div>
                    <p className="font-medium text-navy text-sm">{unit.unit_number}</p>
                    {isDone ? (
                      <p className="text-xs text-slate reading">
                        Elec: {Number(reading.curr_elec_reading)} · Water: {Number(reading.curr_water_reading)}
                      </p>
                    ) : (
                      <p className="text-xs text-coral">Reading pending</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Generated Bills */}
        {cycle.bills.length > 0 && (
          <Card padding="none">
            <CardHeader className="px-5 pt-5">
              <CardTitle>Bills ({cycle.bills.length})</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Unit</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Tenant</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Total</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cycle.bills.map((bill) => (
                    <tr key={bill.id} className="border-b border-border last:border-0 hover:bg-bg">
                      <td className="px-5 py-3.5 font-medium text-navy">{bill.unit.unit_number}</td>
                      <td className="px-5 py-3.5 text-slate">{bill.lease.tenant.full_name}</td>
                      <td className="px-5 py-3.5 money text-navy">{formatCurrency(Number(bill.total_amount))}</td>
                      <td className="px-5 py-3.5"><StatusPill status={bill.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {selectedUnit && selectedUnitId && (
        <Modal
          open={!!selectedUnit}
          onClose={() => setSelectedUnit(null)}
          title={`Meter Reading — Unit ${selectedUnit}`}
        >
          <MeterReadingForm
            cycleId={cycleId}
            unitId={selectedUnitId}
            existing={readingMap.get(selectedUnitId)}
            onSuccess={() => { setSelectedUnit(null); refetch(); }}
          />
        </Modal>
      )}
    </div>
  );
}
