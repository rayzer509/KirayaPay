'use client';

import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, Calendar, Zap, IndianRupee, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function TenantLeasePage() {
  const { data: leases, isLoading, refetch } = trpc.leases.list.useQuery({ status: 'active' });
  const lease = leases?.[0];
  const acknowledge = trpc.leases.acknowledge.useMutation({
    onSuccess: () => { toast.success('Lease acknowledged'); refetch(); },
    onError: () => toast.error('Failed to acknowledge lease'),
  });

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
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Please read and acknowledge your lease agreement.</span>
          </div>
          <Button
            size="sm"
            onClick={() => acknowledge.mutate({ id: lease.id })}
            loading={acknowledge.isLoading}
            className="shrink-0 bg-amber-700 hover:bg-amber-800 text-white border-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Acknowledge
          </Button>
        </div>
      )}
      {lease.acknowledged_at && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Lease acknowledged on {format(new Date(lease.acknowledged_at), 'dd MMM yyyy')}</span>
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

      {/* Security Deposit */}
      <Card>
        <h2 className="font-semibold text-navy mb-3">Security Deposit</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-bg rounded-lg">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">Amount</p>
            <p className="font-bold text-navy">{formatCurrency(Number(lease.security_deposit))}</p>
          </div>
          <div className="p-3 bg-bg rounded-lg">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">Status</p>
            {lease.deposit_collected
              ? <p className="font-medium text-sage">Received by landlord</p>
              : <p className="font-medium text-coral">Pending confirmation</p>}
          </div>
          {lease.deposit_refund_status && lease.deposit_refund_status !== 'held' && (
            <div className="p-3 bg-bg rounded-lg col-span-2">
              <p className="text-xs text-slate uppercase tracking-wide mb-1">Refund</p>
              <p className="font-medium text-navy capitalize">{lease.deposit_refund_status}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Prior outstanding dues */}
      {lease.opening_balance && Number(lease.opening_balance) > 0 && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
          lease.opening_balance_paid_at
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Prior outstanding dues: {formatCurrency(Number(lease.opening_balance))}</p>
            {lease.opening_balance_note && <p className="text-xs mt-0.5 opacity-80">{lease.opening_balance_note}</p>}
            {lease.opening_balance_paid_at
              ? <p className="text-xs mt-0.5">Paid on {format(new Date(lease.opening_balance_paid_at), 'dd MMM yyyy')}</p>
              : <p className="text-xs mt-0.5">Please settle this with your landlord.</p>}
          </div>
        </div>
      )}

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
