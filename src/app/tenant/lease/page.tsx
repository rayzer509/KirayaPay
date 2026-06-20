'use client';

import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, Calendar, Zap, IndianRupee, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function TenantLeasePage() {
  const { data: leases, isLoading } = trpc.leases.list.useQuery({ status: 'active' });
  const lease = leases?.[0];

  if (isLoading) {
    return (
      <div className="lg:ml-48 p-4 lg:p-6 max-w-2xl space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />)}
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="lg:ml-48 p-4 lg:p-6">
        <EmptyState icon={FileText} title="No active lease" description="You don't have an active lease at the moment" />
      </div>
    );
  }

  const daysLeft = Math.ceil((new Date(lease.end_date).getTime() - Date.now()) / 86400000);

  return (
    <div className="lg:ml-48 p-4 lg:p-6 max-w-2xl space-y-4">
      <div className="mb-2">
        <h1 className="text-lg font-bold text-navy">My Lease</h1>
        <p className="text-sm text-slate">{lease.unit.unit_number} · {lease.unit.property.name}</p>
      </div>

      {!lease.acknowledged_at && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Please acknowledge your lease agreement with your landlord.</span>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-navy">Lease Terms</h2>
          <StatusPill status={lease.status} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-bg rounded-lg">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">Monthly Rent</p>
            <p className="font-bold text-navy text-lg money">{formatCurrency(Number(lease.monthly_rent))}</p>
          </div>

          <div className="p-3 bg-bg rounded-lg">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">Due Day</p>
            <p className="font-semibold text-navy flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate" />
              {lease.rent_due_day}{ordinal(lease.rent_due_day)} of month
            </p>
          </div>

          <div className="p-3 bg-bg rounded-lg">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">Security Deposit</p>
            <p className="font-semibold text-navy flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5 text-slate" />
              {formatCurrency(Number(lease.security_deposit))}
            </p>
          </div>

          <div className="p-3 bg-bg rounded-lg">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">Sanctioned Load</p>
            <p className="font-semibold text-navy flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-saffron" />
              {Number(lease.sanctioned_load_kw)} kW
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-navy mb-3">Lease Period</h2>
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-xs text-slate uppercase tracking-wide mb-0.5">Start</p>
            <p className="font-medium text-navy">{formatDate(lease.start_date)}</p>
          </div>
          <div className="flex-1 mx-4 border-t-2 border-dashed border-border" />
          <div className="text-right">
            <p className="text-xs text-slate uppercase tracking-wide mb-0.5">End</p>
            <p className="font-medium text-navy">{formatDate(lease.end_date)}</p>
          </div>
        </div>
        {daysLeft > 0 && daysLeft <= 90 && (
          <p className="text-xs text-coral mt-3 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Lease expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — contact your landlord for renewal
          </p>
        )}
        {daysLeft > 90 && (
          <p className="text-xs text-slate mt-3">{daysLeft} days remaining</p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-navy mb-1">Property</h2>
        <p className="text-sm text-slate">{lease.unit.property.name}</p>
        <p className="text-sm font-medium text-navy mt-0.5">Unit {lease.unit.unit_number}</p>
        {lease.unit.floor != null && <p className="text-xs text-slate">Floor {lease.unit.floor}</p>}
        {lease.unit.area_sqft && <p className="text-xs text-slate">{Number(lease.unit.area_sqft)} sq ft</p>}
      </Card>

      <p className="text-xs text-slate text-center pb-2">
        Last updated {format(new Date(lease.created_at), 'dd MMM yyyy')}
      </p>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
