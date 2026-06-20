import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TenantNav } from '@/components/tenant/TenantNav';

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-bg">
      <TenantNav />
      <main className="pb-16 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
