'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

const schema = z.object({
  monthly_rent: z.coerce.number().positive('Required'),
  security_deposit: z.coerce.number().nonnegative('Required'),
  sanctioned_load_kw: z.coerce.number().positive('Required'),
  rent_due_day: z.coerce.number().int().min(1).max(28),
  start_date: z.string().min(1, 'Required'),
  end_date: z.string().min(1, 'Required'),
  billing_start_date: z.string().optional(),
  escalation_rate: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  next_escalation_date: z.string().optional(),
  deposit_collected: z.boolean().default(false),
  deposit_collected_at: z.string().optional(),
  deposit_collected_via: z.string().optional(),
  opening_balance: z.coerce.number().nonnegative().optional().or(z.literal('')),
  opening_balance_note: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

export function LeaseForm({ onSuccess }: { onSuccess: () => void }) {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [depositCollected, setDepositCollected] = useState(false);
  const [depositVia, setDepositVia] = useState('');
  const [hasOpeningBalance, setHasOpeningBalance] = useState(false);

  const { data: properties } = trpc.properties.list.useQuery();
  const { data: units } = trpc.units.list.useQuery(
    { property_id: selectedProperty },
    { enabled: !!selectedProperty }
  );
  const { data: tenants } = trpc.tenants.list.useQuery({ status: 'all' });

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rent_due_day: 5, security_deposit: 0, sanctioned_load_kw: 1, deposit_collected: false },
  });

  const createLease = trpc.leases.create.useMutation();

  const propertyOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));
  const unitOptions = (units ?? []).map((u) => ({ value: u.id, label: `${u.unit_number} (${u.status})` }));
  const tenantOptions = (tenants ?? []).map((t) => ({ value: t.id, label: `${t.full_name} · ${t.phone}` }));

  async function onSubmit(data: FormValues) {
    if (!selectedUnit) return toast.error('Select a unit');
    if (!selectedTenant) return toast.error('Select a tenant');
    try {
      await createLease.mutateAsync({
        ...data,
        unit_id: selectedUnit,
        tenant_id: selectedTenant,
        escalation_rate: data.escalation_rate !== '' && data.escalation_rate !== undefined
          ? Number(data.escalation_rate) : undefined,
        opening_balance: data.opening_balance !== '' && data.opening_balance !== undefined
          ? Number(data.opening_balance) : undefined,
        deposit_collected: depositCollected,
        deposit_collected_via: depositVia || undefined,
      });
      toast.success('Lease created');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create lease');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select label="Property" value={selectedProperty} onValueChange={setSelectedProperty} options={propertyOptions} placeholder="Select property…" />
      {selectedProperty && (
        <Select label="Unit" value={selectedUnit} onValueChange={setSelectedUnit} options={unitOptions} placeholder="Select unit…" />
      )}
      <Select label="Tenant" value={selectedTenant} onValueChange={setSelectedTenant} options={tenantOptions} placeholder="Select tenant…" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Monthly Rent (₹)" type="number" step="0.01" error={errors.monthly_rent?.message} {...register('monthly_rent')} />
        <Input label="Security Deposit (₹)" type="number" step="0.01" error={errors.security_deposit?.message} {...register('security_deposit')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Sanctioned Load (kW)" type="number" step="0.5" error={errors.sanctioned_load_kw?.message} {...register('sanctioned_load_kw')} hint="Determines fixed connection charge" />
        <Input label="Rent Due Day" type="number" min={1} max={28} error={errors.rent_due_day?.message} {...register('rent_due_day')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Lease Start Date" type="date" error={errors.start_date?.message} {...register('start_date')} />
        <Input label="Lease End Date" type="date" error={errors.end_date?.message} {...register('end_date')} />
      </div>

      {/* Advanced / Pre-existing tenant options */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-slate hover:text-navy underline underline-offset-2 transition"
      >
        {showAdvanced ? 'Hide advanced options' : 'Show advanced options (pre-existing tenants, escalation)'}
      </button>

      {showAdvanced && (
        <div className="space-y-4 border border-border rounded-lg p-4 bg-bg">
          <p className="text-xs text-slate font-medium uppercase tracking-wide">Pre-existing Tenant / Advanced</p>

          <Input
            label="KirayaPay Billing Start Date"
            type="date"
            hint="Leave blank for new tenants. For existing tenants, set to the month KirayaPay should start generating bills."
            {...register('billing_start_date')}
          />

          {/* Security deposit already collected */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={depositCollected}
                onChange={(e) => setDepositCollected(e.target.checked)}
                className="w-4 h-4 rounded border-border text-saffron"
              />
              <span className="text-navy font-medium">Security deposit already collected</span>
            </label>
            {depositCollected && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <Input label="Date Collected" type="date" {...register('deposit_collected_at')} />
                <Select
                  label="Method"
                  value={depositVia}
                  onValueChange={setDepositVia}
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'upi', label: 'UPI' },
                    { value: 'cheque', label: 'Cheque' },
                    { value: 'bank_transfer', label: 'Bank Transfer' },
                  ]}
                  placeholder="Select method…"
                />
              </div>
            )}
          </div>

          {/* Opening balance */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={hasOpeningBalance}
                onChange={(e) => setHasOpeningBalance(e.target.checked)}
                className="w-4 h-4 rounded border-border text-saffron"
              />
              <span className="text-navy font-medium">Tenant has outstanding dues from before KirayaPay</span>
            </label>
            {hasOpeningBalance && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <Input
                  label="Amount Outstanding (₹)"
                  type="number"
                  step="0.01"
                  hint="E.g. one month's deferred rent"
                  {...register('opening_balance')}
                />
                <Input
                  label="Note"
                  placeholder="E.g. June 2026 rent pending"
                  {...register('opening_balance_note')}
                />
              </div>
            )}
          </div>

          {/* Annual escalation */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Annual Rent Increase (%)"
              type="number"
              step="0.5"
              min={0}
              max={100}
              hint="E.g. 10 for 10% yearly increase. Leave blank for no escalation."
              {...register('escalation_rate')}
            />
            <Input
              label="First Increase Date"
              type="date"
              hint="Date of the first automatic rent increase"
              {...register('next_escalation_date')}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={createLease.isLoading}>Create Lease</Button>
      </div>
    </form>
  );
}
