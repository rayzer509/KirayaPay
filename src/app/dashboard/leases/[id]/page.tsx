'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Zap, IndianRupee, Calendar, FileText, AlertTriangle, Pencil, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type AmendField = 'monthly_rent' | 'sanctioned_load_kw' | 'end_date' | 'rent_due_day';

const AMEND_CONFIG: Record<AmendField, { label: string; unit?: string; inputType: string; placeholder: string }> = {
  monthly_rent:        { label: 'Monthly Rent',      unit: '₹',   inputType: 'number', placeholder: 'New rent amount' },
  sanctioned_load_kw:  { label: 'Sanctioned Load',   unit: 'kW',  inputType: 'number', placeholder: 'New load in kW' },
  end_date:            { label: 'Lease End Date',                  inputType: 'date',   placeholder: '' },
  rent_due_day:        { label: 'Rent Due Day',       unit: 'day', inputType: 'number', placeholder: '1–28' },
};

export default function LeaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [amendField, setAmendField] = useState<AmendField | null>(null);
  const [newValue, setNewValue] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [amendNote, setAmendNote] = useState('');
  const [showTerminate, setShowTerminate] = useState(false);

  const { data: lease, isLoading, refetch } = trpc.leases.get.useQuery({ id: params.id });
  const amend = trpc.leases.amend.useMutation();
  const terminate = trpc.leases.terminate.useMutation();

  function openAmend(field: AmendField) {
    setAmendField(field);
    setNewValue('');
    setEffectiveFrom(format(new Date(), 'yyyy-MM-dd'));
    setAmendNote('');
  }

  function closeAmend() {
    setAmendField(null);
    setNewValue('');
    setEffectiveFrom('');
    setAmendNote('');
  }

  async function handleAmend() {
    if (!lease || !amendField || !newValue) return;
    const config = AMEND_CONFIG[amendField];
    const oldValue = String(
      amendField === 'monthly_rent' ? Number(lease.monthly_rent) :
      amendField === 'sanctioned_load_kw' ? Number(lease.sanctioned_load_kw) :
      amendField === 'end_date' ? format(new Date(lease.end_date), 'yyyy-MM-dd') :
      lease.rent_due_day
    );

    try {
      await amend.mutateAsync({
        lease_id: lease.id,
        field_changed: amendField,
        old_value: oldValue,
        new_value: newValue,
        effective_from: effectiveFrom || format(new Date(), 'yyyy-MM-dd'),
        note: amendNote || undefined,
      });
      toast.success(`${config.label} updated`);
      closeAmend();
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to amend lease');
    }
  }

  async function handleTerminate() {
    if (!lease) return;
    try {
      await terminate.mutateAsync({ id: lease.id });
      toast.success('Lease terminated');
      router.push('/dashboard/leases');
    } catch {
      toast.error('Failed to terminate lease');
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1">
        <Topbar title="Lease" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="text-slate text-sm">Loading…</div>
        </main>
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="flex flex-col flex-1">
        <Topbar title="Lease" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <EmptyState icon={FileText} title="Lease not found" description="This lease may have been removed." />
        </main>
      </div>
    );
  }

  const isActive = lease.status === 'active';

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title={`${lease.tenant.full_name} — Unit ${lease.unit.unit_number}`}
        subtitle={lease.unit.property.name}
      />

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-navy mb-5 transition"
        >
          <ArrowLeft size={14} /> Back to leases
        </button>

        {/* Status bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <StatusPill status={lease.status} />
            {!lease.acknowledged_at && isActive && (
              <span className="text-xs text-coral flex items-center gap-1">
                <AlertTriangle size={12} /> Not acknowledged by tenant
              </span>
            )}
          </div>
          {isActive && (
            <Button variant="danger" size="sm" onClick={() => setShowTerminate(true)}>
              <XCircle size={14} />
              Terminate Lease
            </Button>
          )}
        </div>

        {/* Lease terms */}
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-navy">Lease Terms</h3>
            {isActive && <span className="text-xs text-slate">Click edit to record an amendment</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {/* Monthly rent */}
            <div className="flex items-center justify-between p-3 bg-bg rounded-lg">
              <div>
                <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Monthly Rent</p>
                <p className="font-semibold text-navy font-mono text-base">{formatCurrency(Number(lease.monthly_rent))}</p>
              </div>
              {isActive && (
                <button onClick={() => openAmend('monthly_rent')} className="p-1.5 hover:bg-slate-light rounded-lg text-slate hover:text-navy transition">
                  <Pencil size={14} />
                </button>
              )}
            </div>

            {/* Sanctioned load */}
            <div className="flex items-center justify-between p-3 bg-bg rounded-lg">
              <div>
                <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Sanctioned Load</p>
                <p className="font-semibold text-navy flex items-center gap-1">
                  <Zap size={13} className="text-saffron" />
                  {Number(lease.sanctioned_load_kw)} kW
                </p>
              </div>
              {isActive && (
                <button onClick={() => openAmend('sanctioned_load_kw')} className="p-1.5 hover:bg-slate-light rounded-lg text-slate hover:text-navy transition">
                  <Pencil size={14} />
                </button>
              )}
            </div>

            {/* End date */}
            <div className="flex items-center justify-between p-3 bg-bg rounded-lg">
              <div>
                <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Lease End Date</p>
                <p className="font-semibold text-navy flex items-center gap-1">
                  <Calendar size={13} className="text-slate" />
                  {formatDate(lease.end_date)}
                </p>
              </div>
              {isActive && (
                <button onClick={() => openAmend('end_date')} className="p-1.5 hover:bg-slate-light rounded-lg text-slate hover:text-navy transition">
                  <Pencil size={14} />
                </button>
              )}
            </div>

            {/* Rent due day */}
            <div className="flex items-center justify-between p-3 bg-bg rounded-lg">
              <div>
                <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Rent Due Day</p>
                <p className="font-semibold text-navy">Day {lease.rent_due_day} of each month</p>
              </div>
              {isActive && (
                <button onClick={() => openAmend('rent_due_day')} className="p-1.5 hover:bg-slate-light rounded-lg text-slate hover:text-navy transition">
                  <Pencil size={14} />
                </button>
              )}
            </div>

            {/* Security deposit - read only */}
            <div className="p-3 bg-bg rounded-lg">
              <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Security Deposit</p>
              <p className="font-semibold text-navy font-mono">
                <IndianRupee size={13} className="inline mr-0.5" />
                {formatCurrency(Number(lease.security_deposit))}
              </p>
            </div>

            {/* Lease period - read only */}
            <div className="p-3 bg-bg rounded-lg">
              <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Lease Period</p>
              <p className="text-navy text-xs">
                {formatDate(lease.start_date)} → {formatDate(lease.end_date)}
              </p>
            </div>
          </div>
        </Card>

        {/* Amendment history */}
        {lease.amendments && lease.amendments.length > 0 && (
          <Card className="mb-5">
            <h3 className="font-semibold text-navy mb-4">Amendment History</h3>
            <div className="space-y-3">
              {lease.amendments.map((a) => (
                <div key={a.id} className="flex items-start gap-3 text-sm pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-saffron mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-navy">
                      <span className="font-medium capitalize">{a.field_changed.replace(/_/g, ' ')}</span>
                      {' '}changed from{' '}
                      <span className="font-mono bg-slate-light px-1.5 py-0.5 rounded text-xs">{a.old_value}</span>
                      {' '}to{' '}
                      <span className="font-mono bg-sage/10 text-sage px-1.5 py-0.5 rounded text-xs">{a.new_value}</span>
                    </p>
                    <p className="text-slate text-xs mt-0.5">
                      Effective {formatDate(a.effective_from)}
                      {a.note && <span className="ml-2 text-slate/70">· {a.note}</span>}
                      <span className="ml-2 text-slate/50">· recorded {format(new Date(a.created_at), 'dd MMM yyyy')}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent bills */}
        {lease.bills && lease.bills.length > 0 && (
          <Card>
            <h3 className="font-semibold text-navy mb-4">Recent Bills</h3>
            <div className="space-y-2">
              {lease.bills.map((bill) => {
                const paid = bill.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
                return (
                  <div key={bill.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                    <div>
                      <span className="text-navy font-medium">{formatDate(bill.due_date)}</span>
                      <span className="text-slate text-xs ml-2">due</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {paid > 0 && <span className="text-xs text-sage">Paid {formatCurrency(paid)}</span>}
                      <span className="font-mono text-navy">{formatCurrency(Number(bill.total_amount))}</span>
                      <StatusPill status={bill.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </main>

      {/* ── Amend modal ──────────────────────────────────────────────────────── */}
      {amendField && (
        <Modal
          open={!!amendField}
          onClose={closeAmend}
          title={`Amend — ${AMEND_CONFIG[amendField].label}`}
        >
          <p className="text-sm text-slate mb-4">
            Changes are recorded as amendments with an effective date. Billing will use the new value from that date forward.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">
                New {AMEND_CONFIG[amendField].label}
                {AMEND_CONFIG[amendField].unit && (
                  <span className="font-normal text-slate ml-1">({AMEND_CONFIG[amendField].unit})</span>
                )}
              </label>
              <Input
                type={AMEND_CONFIG[amendField].inputType}
                placeholder={AMEND_CONFIG[amendField].placeholder}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>

            {amendField !== 'end_date' && (
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Effective from</label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">
                Note <span className="font-normal text-slate">(optional)</span>
              </label>
              <Input
                placeholder="Reason for amendment…"
                value={amendNote}
                onChange={(e) => setAmendNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <Button variant="secondary" onClick={closeAmend}>Cancel</Button>
            <Button
              onClick={handleAmend}
              loading={amend.isLoading}
              disabled={!newValue}
            >
              Save Amendment
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Terminate modal ──────────────────────────────────────────────────── */}
      <Modal open={showTerminate} onClose={() => setShowTerminate(false)} title="Terminate Lease">
        <p className="text-sm text-slate mb-1">
          Terminate the lease for <span className="font-semibold text-navy">{lease.tenant.full_name}</span> in Unit {lease.unit.unit_number}?
        </p>
        <p className="text-sm text-slate mb-6">
          The unit will be marked as vacant. Any unpaid bills will remain outstanding.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowTerminate(false)}>Cancel</Button>
          <Button variant="danger" loading={terminate.isLoading} onClick={handleTerminate}>
            <XCircle size={14} />
            Terminate Lease
          </Button>
        </div>
      </Modal>
    </div>
  );
}
