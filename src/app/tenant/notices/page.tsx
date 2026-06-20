'use client';

import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Bell } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default function TenantNoticesPage() {
  const { data: leases } = trpc.leases.list.useQuery({ status: 'active' });
  const activeLease = leases?.[0];

  const { data: notices, isLoading } = trpc.notices.list.useQuery(
    { property_id: activeLease?.unit.property_id },
    { enabled: !!activeLease?.unit.property_id }
  );

  return (
    <div className="lg:ml-48 p-4 lg:p-6 max-w-2xl space-y-4">
      <h1 className="text-lg font-bold text-navy">Notices</h1>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />)}
        </div>
      )}

      {!isLoading && notices?.length === 0 && (
        <EmptyState icon={Bell} title="No notices" description="Your landlord hasn't posted any notices yet" />
      )}

      {notices && notices.length > 0 && (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card key={notice.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-navy text-sm mb-1">{notice.title_en}</h3>
                  {notice.title_hi && (
                    <p className="text-sm text-slate mb-1 font-medium" style={{ fontFamily: 'serif' }}>{notice.title_hi}</p>
                  )}
                  <p className="text-sm text-slate leading-relaxed">{notice.body_en}</p>
                  {notice.body_hi && (
                    <p className="text-sm text-slate mt-1 leading-relaxed" style={{ fontFamily: 'serif' }}>{notice.body_hi}</p>
                  )}
                  <p className="text-xs text-slate mt-2">{formatDateTime(notice.sent_at)}</p>
                </div>
                <div className="shrink-0">
                  <div className="w-8 h-8 rounded-full bg-saffron/10 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-saffron" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
