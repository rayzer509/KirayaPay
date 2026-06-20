'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';

const schema = z.object({
  base_rate_per_kw: z.coerce.number().positive('Must be positive'),
  elec_rate_per_unit: z.coerce.number().positive('Must be positive'),
  water_rate_per_kl: z.coerce.number().positive('Must be positive'),
  effective_from: z.string().min(1, 'Date required'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  propertyId: string;
  currentRate?: { base_rate_per_kw: number; elec_rate_per_unit: number; water_rate_per_kl: number };
  onSuccess: () => void;
}

export function RateForm({ propertyId, currentRate, onSuccess }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...currentRate,
      effective_from: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const setRate = trpc.properties.setRate.useMutation();

  async function onSubmit(data: FormValues) {
    try {
      await setRate.mutateAsync({ ...data, property_id: propertyId });
      toast.success('Rates updated — new rate will apply to future billing cycles');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update rates');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="p-3 bg-saffron-light rounded-lg text-sm text-saffron">
        New rates are versioned — existing bills will not be affected.
      </div>
      <Input
        label="Base charge per kW / month (₹)"
        type="number"
        step="0.01"
        placeholder="150.00"
        error={errors.base_rate_per_kw?.message}
        {...register('base_rate_per_kw')}
        hint="Fixed monthly charge per kW of sanctioned load"
      />
      <Input
        label="Electricity rate per unit (₹/kWh)"
        type="number"
        step="0.01"
        placeholder="6.50"
        error={errors.elec_rate_per_unit?.message}
        {...register('elec_rate_per_unit')}
      />
      <Input
        label="Water rate per kilolitre (₹/kL)"
        type="number"
        step="0.01"
        placeholder="25.00"
        error={errors.water_rate_per_kl?.message}
        {...register('water_rate_per_kl')}
      />
      <Input
        label="Effective from"
        type="date"
        error={errors.effective_from?.message}
        {...register('effective_from')}
      />
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={setRate.isLoading}>Save Rates</Button>
      </div>
    </form>
  );
}
