'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useState } from 'react';

const schema = z.object({
  unit_number: z.string().min(1, 'Unit number required'),
  floor: z.coerce.number().int().optional(),
  area_sqft: z.coerce.number().positive().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  propertyId: string;
  onSuccess: () => void;
}

export function UnitForm({ propertyId, onSuccess }: Props) {
  const [status, setStatus] = useState<'vacant' | 'occupied'>('vacant');
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const createMut = trpc.units.create.useMutation();

  async function onSubmit(data: FormValues) {
    try {
      await createMut.mutateAsync({ ...data, property_id: propertyId, status });
      toast.success('Unit added');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create unit');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Unit Number" placeholder="e.g. 2B, GF-01" error={errors.unit_number?.message} {...register('unit_number')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Floor (optional)" type="number" placeholder="0" {...register('floor')} />
        <Input label="Area (sqft, optional)" type="number" placeholder="450" {...register('area_sqft')} />
      </div>
      <Select
        label="Status"
        value={status}
        onValueChange={(v) => setStatus(v as 'vacant' | 'occupied')}
        options={[{ value: 'vacant', label: 'Vacant' }, { value: 'occupied', label: 'Occupied' }]}
      />
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={createMut.isLoading}>Add Unit</Button>
      </div>
    </form>
  );
}
