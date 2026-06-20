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
});

type FormValues = z.infer<typeof schema>;

export function LeaseForm({ onSuccess }: { onSuccess: () => void }) {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');

  const { data: properties } = trpc.properties.list.useQuery();
  const [selectedProperty, setSelectedProperty] = useState('');
  const { data: units } = trpc.units.list.useQuery(
    { property_id: selectedProperty },
    { enabled: !!selectedProperty }
  );
  const { data: tenants } = trpc.tenants.list.useQuery({ status: 'all' });

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rent_due_day: 5, security_deposit: 0, sanctioned_load_kw: 1 },
  });

  const createLease = trpc.leases.create.useMutation();

  const propertyOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));
  const unitOptions = (units ?? [])
    .map((u) => ({ value: u.id, label: `${u.unit_number} (${u.status})` }));
  const tenantOptions = (tenants ?? []).map((t) => ({ value: t.id, label: `${t.full_name} · ${t.phone}` }));

  async function onSubmit(data: FormValues) {
    if (!selectedUnit) return toast.error('Select a unit');
    if (!selectedTenant) return toast.error('Select a tenant');
    try {
      await createLease.mutateAsync({
        ...data,
        unit_id: selectedUnit,
        tenant_id: selectedTenant,
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
        <Input label="Start Date" type="date" error={errors.start_date?.message} {...register('start_date')} />
        <Input label="End Date" type="date" error={errors.end_date?.message} {...register('end_date')} />
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={createLease.isLoading}>Create Lease</Button>
      </div>
    </form>
  );
}
