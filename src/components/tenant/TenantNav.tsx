'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, Wrench, MessageSquare, LogOut, ScrollText, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';

const NAV = [
  { href: '/tenant', label: 'Bills', icon: FileText },
  { href: '/tenant/lease', label: 'Lease', icon: ScrollText },
  { href: '/tenant/notices', label: 'Notices', icon: Bell },
  { href: '/tenant/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/tenant/messages', label: 'Messages', icon: MessageSquare },
];

export function TenantNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { data: me } = trpc.auth.me.useQuery();

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <>
      {/* Top header */}
      <header className="bg-navy text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-saffron flex items-center justify-center">
            <span className="text-white font-bold text-xs">P</span>
          </div>
          <span className="font-bold text-sm">PropEase</span>
        </div>
        <div className="flex items-center gap-3">
          {me && <span className="text-white/70 text-sm hidden sm:block">{me.full_name}</span>}
          <button onClick={signOut} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Bottom nav (mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-30">
        <div className="flex items-center justify-around h-14">
          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/tenant' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg text-xs font-medium transition',
                  isActive ? 'text-saffron' : 'text-slate hover:text-navy'
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop side nav */}
      <aside className="hidden lg:flex fixed left-0 top-[52px] bottom-0 w-48 bg-surface border-r border-border flex-col px-3 py-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/tenant' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition mb-0.5',
                isActive ? 'bg-saffron-light text-saffron' : 'text-slate hover:text-navy hover:bg-slate-light'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </aside>
    </>
  );
}
