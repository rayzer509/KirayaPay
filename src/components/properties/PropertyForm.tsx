'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  upi_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  onSuccess: () => void;
  defaultValues?: Partial<FormValues> & { id?: string };
}

export function PropertyForm({ onSuccess, defaultValues }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const createMut = trpc.properties.create.useMutation();
  const updateMut = trpc.properties.update.useMutation();

  async function onSubmit(data: FormValues) {
    try {
      if (defaultValues?.id) {
        await updateMut.mutateAsync({ ...data, id: defaultValues.id });
        toast.success('Property updated');
      } else {
        await createMut.mutateAsync(data);
        toast.success('Property created');
      }
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  const isLoading = createMut.isLoading || updateMut.isLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Property Name" placeholder="e.g. Sharma Residency" error={errors.name?.message} {...register('name')} />
      <Input label="Address" placeholder="Street address" error={errors.address?.message} {...register('address')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="City" placeholder="Mumbai" error={errors.city?.message} {...register('city')} />
        <Input label="State" placeholder="Maharashtra" error={errors.state?.message} {...register('state')} />
      </div>
      <Input label="UPI ID (optional)" placeholder="landlord@upi" {...register('upi_id')} />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={isLoading}>
          {defaultValues?.id ? 'Update Property' : 'Create Property'}
        </Button>
      </div>
    </form>
  );
}
