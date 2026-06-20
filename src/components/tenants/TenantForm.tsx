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
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().length(10, 'Enter 10-digit number').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function TenantForm({ onSuccess }: { onSuccess: () => void }) {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const createMut = trpc.tenants.create.useMutation();

  async function onSubmit(data: FormValues) {
    try {
      await createMut.mutateAsync({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ? `+91${data.phone}` : undefined,
        preferred_lang: lang,
      });
      toast.success('Tenant added — an invite email has been sent to them.');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tenant');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Full Name" placeholder="Rajesh Kumar" error={errors.full_name?.message} {...register('full_name')} />
      <Input label="Email" type="email" placeholder="rajesh@email.com" error={errors.email?.message} {...register('email')} hint="An invite link will be sent to this address" />
      <div className="flex gap-2">
        <div className="flex items-center justify-center px-3 rounded-lg border border-border bg-slate-light text-navy font-medium text-sm select-none mt-6 h-[42px]">
          +91
        </div>
        <div className="flex-1">
          <Input label="Mobile Number (optional)" placeholder="9876543210" error={errors.phone?.message} {...register('phone')} />
        </div>
      </div>
      <Select
        label="Preferred Language"
        value={lang}
        onValueChange={(v) => setLang(v as 'en' | 'hi')}
        options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिंदी (Hindi)' }]}
      />
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={createMut.isLoading}>Add Tenant</Button>
      </div>
    </form>
  );
}
