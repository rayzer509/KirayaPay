'use client';

import { trpc } from '@/lib/trpc';

interface TopbarProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Topbar({ title, subtitle, action }: TopbarProps) {
  const { data: me } = trpc.auth.me.useQuery();

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-surface border-b border-border shrink-0">
      <div>
        <h1 className="text-base font-semibold text-navy leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate leading-tight">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {action}
        {me && (
          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-full bg-saffron-light flex items-center justify-center">
              <span className="text-saffron text-xs font-bold">
                {me.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium text-navy hidden sm:block">{me.full_name}</span>
          </div>
        )}
      </div>
    </header>
  );
}
