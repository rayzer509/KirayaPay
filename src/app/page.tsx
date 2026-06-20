import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export default async function RootPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const profile = await prisma.user.findFirst({
    where: { id: user.id, deleted_at: null },
    select: { role: true },
  });

  if (!profile) redirect('/login');

  if (profile.role === 'tenant') redirect('/tenant');

  redirect('/dashboard');
}
