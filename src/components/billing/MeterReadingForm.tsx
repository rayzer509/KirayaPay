'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toDecimalNumber } from '@/lib/utils';
// Wire-safe version of MeterReading — Decimal fields arrive as strings over JSON
// (superjson is no longer used as the tRPC transformer).
type WireMeterReading = {
  prev_elec_reading:  string | number | { toNumber(): number };
  curr_elec_reading:  string | number | { toNumber(): number };
  prev_water_reading: string | number | { toNumber(): number };
  curr_water_reading: string | number | { toNumber(): number };
  is_estimated:       boolean;
  [key: string]:      unknown;
};

const schema = z.object({
  prev_elec_reading: z.coerce.number().nonnegative(),
  curr_elec_reading: z.coerce.number().nonnegative(),
  prev_water_reading: z.coerce.number().nonnegative(),
  curr_water_reading: z.coerce.number().nonnegative(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  cycleId: string;
  unitId: string;
  existing?: WireMeterReading;
  onSuccess: () => void;
}

export function MeterReadingForm({ cycleId, unitId, existing, onSuccess }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing ? {
      prev_elec_reading: toDecimalNumber(existing.prev_elec_reading),
      curr_elec_reading: toDecimalNumber(existing.curr_elec_reading),
      prev_water_reading: toDecimalNumber(existing.prev_water_reading),
      curr_water_reading: toDecimalNumber(existing.curr_water_reading),
    } : {},
  });

  const values = watch();
  const elecConsumed = (values.curr_elec_reading ?? 0) - (values.prev_elec_reading ?? 0);
  const waterConsumed = (values.curr_water_reading ?? 0) - (values.prev_water_reading ?? 0);

  const { data: anomaly } = trpc.billing.checkAnomaly.useQuery(
    {
      unit_id: unitId,
      curr_elec_reading: values.curr_elec_reading ?? 0,
      prev_elec_reading: values.prev_elec_reading ?? 0,
      curr_water_reading: values.curr_water_reading ?? 0,
      prev_water_reading: values.prev_water_reading ?? 0,
    },
    { enabled: elecConsumed > 0 || waterConsumed > 0 }
  );

  const saveReading = trpc.billing.saveReading.useMutation();

  async function onSubmit(data: FormValues) {
    if (data.curr_elec_reading < data.prev_elec_reading) {
      return toast.error('Current reading cannot be less than previous');
    }
    if (data.curr_water_reading < data.prev_water_reading) {
      return toast.error('Current water reading cannot be less than previous');
    }
    try {
      await saveReading.mutateAsync({ cycle_id: cycleId, unit_id: unitId, ...data });
      toast.success('Reading saved');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save reading');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Electricity */}
      <div>
        <p className="text-sm font-semibold text-navy mb-2">⚡ Electricity (kWh units)</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Previous Reading" type="number" step="0.01" className="reading" error={errors.prev_elec_reading?.message} {...register('prev_elec_reading')} />
          <Input label="Current Reading" type="number" step="0.01" className="reading" error={errors.curr_elec_reading?.message} {...register('curr_elec_reading')} />
        </div>
        {elecConsumed > 0 && (
          <p className="text-xs text-slate mt-1 reading">Consumed: {elecConsumed.toFixed(2)} units</p>
        )}
        {anomaly?.elec && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-coral-light rounded-lg">
            <AlertTriangle className="w-4 h-4 text-coral shrink-0" />
            <p className="text-xs text-coral">High usage — {elecConsumed.toFixed(0)} units is &gt;130% of 3-month average</p>
          </div>
        )}
      </div>

      {/* Water */}
      <div>
        <p className="text-sm font-semibold text-navy mb-2">💧 Water (kilolitres)</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Previous Reading" type="number" step="0.001" className="reading" error={errors.prev_water_reading?.message} {...register('prev_water_reading')} />
          <Input label="Current Reading" type="number" step="0.001" className="reading" error={errors.curr_water_reading?.message} {...register('curr_water_reading')} />
        </div>
        {waterConsumed > 0 && (
          <p className="text-xs text-slate mt-1 reading">Consumed: {waterConsumed.toFixed(3)} kL</p>
        )}
        {anomaly?.water && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-coral-light rounded-lg">
            <AlertTriangle className="w-4 h-4 text-coral shrink-0" />
            <p className="text-xs text-coral">High usage — water consumption is &gt;130% of 3-month average</p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={saveReading.isLoading}>Save Reading</Button>
      </div>
    </form>
  );
}
