'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as Tabs from '@radix-ui/react-tabs';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { downloadReceipt } from '@/lib/receipt';
import {
  User, Phone, Mail, Home, Zap, Droplets, Calendar,
  ChevronDown, ChevronUp, Download, ArrowLeft, Wrench,
  FileText, AlertCircle, UserX, MailCheck
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showOffboard, setShowOffboard] = useState(false);

  const { data: tenant, isLoading } = trpc.tenants.get.useQuery({ id: params.id });
  const { data: bills } = trpc.billing.listBills.useQuery({ tenant_id: params.id, status: 'all' });
  const { data: maintenance } = trpc.maintenance.list.useQuery({ status: 'all' });
  const offboard = trpc.tenants.offboard.useMutation();
  const resendInvite = trpc.tenants.resendInvite.useMutation();

  async function handleResendInvite() {
    try {
      await resendInvite.mutateAsync({ id: params.id });
      toast.success('Invite email resent');
    } catch {
      toast.error('Failed to resend invite');
    }
  }

  async function handleOffboard() {
    try {
      await offboard.mutateAsync({ id: params.id });
      toast.success(`${tenant?.full_name} removed`);
      router.push('/dashboard/tenants');
    } catch {
      toast.error('Failed to remove tenant');
    }
  }

  const activeLease = tenant?.leases?.find((l) => l.status === 'active');
  const tenantMaintenance = maintenance?.filter(
    (m) => m.unit_id === activeLease?.unit_id
  );


  if (isLoading) {
    return (
      <div className="flex flex-col flex-1">
        <Topbar title="Tenant" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="text-slate text-sm">Loading…</div>
        </main>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col flex-1">
        <Topbar title="Tenant" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <EmptyState icon={User} title="Tenant not found" description="This tenant may have been removed." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title={tenant.full_name}
        subtitle={activeLease ? `${activeLease.unit.property.name} — Unit ${activeLease.unit.unit_number}` : 'No active lease'}
      />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-navy mb-5 transition"
        >
          <ArrowLeft size={14} /> Back to tenants
        </button>

        {/* Info header */}
        <Card className="mb-6">
          <div className="flex flex-wrap items-start gap-6 p-2">
            <div className="w-12 h-12 rounded-full bg-navy flex items-center justify-center text-white font-bold text-lg shrink-0">
              {tenant.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h2 className="text-lg font-semibold text-navy">{tenant.full_name}</h2>
                <StatusPill
                  status={activeLease ? 'active' : 'inactive'}
                />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate">
                <span className="flex items-center gap-1.5"><Phone size={13} />{tenant.phone}</span>
                {tenant.email && <span className="flex items-center gap-1.5"><Mail size={13} />{tenant.email}</span>}
                <span className="flex items-center gap-1.5 capitalize">
                  <FileText size={13} />Lang: {tenant.preferred_lang === 'hi' ? 'Hindi' : 'English'}
                </span>
                <span className="flex items-center gap-1.5 text-slate/70">
                  Joined {format(new Date(tenant.created_at), 'dd MMM yyyy')}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResendInvite}
                loading={resendInvite.isLoading}
                title="Resend invite email"
              >
                <MailCheck size={14} className="mr-1" />
                Resend Invite
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOffboard(true)}
                className="text-coral hover:bg-coral/10"
              >
                <UserX size={14} className="mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs.Root defaultValue="lease">
          <Tabs.List className="flex gap-1 p-1 bg-slate-light rounded-lg w-fit mb-6">
            {[
              { value: 'lease', label: 'Lease' },
              { value: 'bills', label: `Bills${bills ? ` (${bills.length})` : ''}` },
              { value: 'maintenance', label: `Maintenance${tenantMaintenance ? ` (${tenantMaintenance.length})` : ''}` },
            ].map((tab) => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="px-4 py-1.5 rounded-md text-sm font-medium text-slate data-[state=active]:bg-surface data-[state=active]:text-navy data-[state=active]:shadow-sm transition"
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* ── Lease tab ──────────────────────────────────────────────────── */}
          <Tabs.Content value="lease">
            {!activeLease ? (
              <EmptyState icon={Home} title="No active lease" description="This tenant does not have an active lease." />
            ) : (
              <div className="space-y-4">
                <Card>
                  <div className="p-1">
                    <h3 className="font-semibold text-navy mb-4">Active Lease</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                      <div>
                        <p className="text-slate text-xs uppercase tracking-wide mb-1">Property</p>
                        <p className="text-navy font-medium">{activeLease.unit.property.name}</p>
                      </div>
                      <div>
                        <p className="text-slate text-xs uppercase tracking-wide mb-1">Unit</p>
                        <p className="text-navy font-medium">{activeLease.unit.unit_number}</p>
                      </div>
                      <div>
                        <p className="text-slate text-xs uppercase tracking-wide mb-1">Monthly Rent</p>
                        <p className="text-navy font-semibold font-mono">{formatCurrency(Number(activeLease.monthly_rent))}</p>
                      </div>
                      <div>
                        <p className="text-slate text-xs uppercase tracking-wide mb-1">Security Deposit</p>
                        <p className="text-navy font-mono">{formatCurrency(Number(activeLease.security_deposit))}</p>
                      </div>
                      <div>
                        <p className="text-slate text-xs uppercase tracking-wide mb-1">Sanctioned Load</p>
                        <p className="text-navy flex items-center gap-1">
                          <Zap size={13} className="text-saffron" />
                          {Number(activeLease.sanctioned_load_kw)} kW
                        </p>
                      </div>
                      <div>
                        <p className="text-slate text-xs uppercase tracking-wide mb-1">Rent Due Day</p>
                        <p className="text-navy">Day {activeLease.rent_due_day}</p>
                      </div>
                      <div>
                        <p className="text-slate text-xs uppercase tracking-wide mb-1">Lease Start</p>
                        <p className="text-navy">{format(new Date(activeLease.start_date), 'dd MMM yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-slate text-xs uppercase tracking-wide mb-1">Lease End</p>
                        <p className="text-navy">{format(new Date(activeLease.end_date), 'dd MMM yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-slate text-xs uppercase tracking-wide mb-1">Acknowledged</p>
                        <p className="text-navy">
                          {activeLease.acknowledged_at
                            ? format(new Date(activeLease.acknowledged_at), 'dd MMM yyyy')
                            : <span className="text-coral">Pending</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Amendments */}
                {activeLease.amendments && activeLease.amendments.length > 0 && (
                  <Card>
                    <div className="p-1">
                      <h3 className="font-semibold text-navy mb-3">Amendments</h3>
                      <div className="space-y-3">
                        {activeLease.amendments.map((amendment) => (
                          <div key={amendment.id} className="flex items-start gap-3 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-saffron mt-1.5 shrink-0" />
                            <div>
                              <p className="text-navy">
                                <span className="font-medium capitalize">{amendment.field_changed.replace(/_/g, ' ')}</span>
                                {' '}changed from{' '}
                                <span className="font-mono bg-slate-light px-1 rounded">{amendment.old_value}</span>
                                {' '}to{' '}
                                <span className="font-mono bg-sage/10 text-sage px-1 rounded">{amendment.new_value}</span>
                              </p>
                              <p className="text-slate text-xs mt-0.5">
                                Effective {format(new Date(amendment.effective_from), 'dd MMM yyyy')}
                                {amendment.note && ` · ${amendment.note}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Past leases */}
                {tenant.leases.filter((l) => l.status !== 'active').length > 0 && (
                  <Card>
                    <div className="p-1">
                      <h3 className="font-semibold text-navy mb-3">Past Leases</h3>
                      <div className="space-y-2">
                        {tenant.leases.filter((l) => l.status !== 'active').map((lease) => (
                          <div key={lease.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                            <div>
                              <p className="text-navy font-medium">{lease.unit.property.name} — Unit {lease.unit.unit_number}</p>
                              <p className="text-slate text-xs">
                                {format(new Date(lease.start_date), 'dd MMM yyyy')} – {format(new Date(lease.end_date), 'dd MMM yyyy')}
                              </p>
                            </div>
                            <StatusPill status={lease.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </Tabs.Content>

          {/* ── Bills tab ──────────────────────────────────────────────────── */}
          <Tabs.Content value="bills">
            {!bills || bills.length === 0 ? (
              <EmptyState icon={FileText} title="No bills yet" description="Bills will appear here once a billing cycle is closed." />
            ) : (
              <div className="space-y-2">
                {bills.map((bill) => {
                  const isExpanded = expandedBill === bill.id;
                  const paid = bill.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
                  const outstanding = Math.max(0, Number(bill.total_amount) - paid);

                  return (
                    <Card key={bill.id} className="overflow-hidden">
                      {/* Bill row */}
                      <button
                        className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-light/50 transition"
                        onClick={() => setExpandedBill(isExpanded ? null : bill.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium text-navy">
                              {bill.cycle ? format(new Date(bill.cycle.cycle_month), 'MMMM yyyy') : 'Bill'}
                            </span>
                            <StatusPill status={bill.status} />
                          </div>
                          <p className="text-xs text-slate">
                            Due {format(new Date(bill.due_date), 'dd MMM yyyy')}
                            {outstanding > 0 && bill.status !== 'paid' && (
                              <span className="ml-2 text-coral font-medium">Outstanding: {formatCurrency(outstanding)}</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold font-mono text-navy">{formatCurrency(Number(bill.total_amount))}</p>
                          {paid > 0 && (
                            <p className="text-xs text-sage">Paid {formatCurrency(paid)}</p>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-slate shrink-0" /> : <ChevronDown size={16} className="text-slate shrink-0" />}
                      </button>

                      {/* Expanded: line items + payments */}
                      {isExpanded && (
                        <div className="border-t border-border bg-slate-light/30 px-4 py-3 space-y-4">
                          {/* Line items */}
                          <div>
                            <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Breakdown</p>
                            <div className="space-y-1">
                              {bill.line_items.map((item) => (
                                <div key={item.id} className="flex justify-between text-sm">
                                  <span className="text-navy flex items-center gap-1.5">
                                    {item.type === 'elec_consumption' || item.type === 'fixed_connection'
                                      ? <Zap size={12} className="text-saffron" />
                                      : item.type === 'water_consumption'
                                      ? <Droplets size={12} className="text-blue-400" />
                                      : <Home size={12} className="text-sage" />}
                                    {item.description}
                                  </span>
                                  <span className="font-mono text-navy">{formatCurrency(Number(item.amount))}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-sm font-semibold text-navy border-t border-border pt-1 mt-1">
                                <span>Total</span>
                                <span className="font-mono">{formatCurrency(Number(bill.total_amount))}</span>
                              </div>
                            </div>
                          </div>

                          {/* Payments */}
                          {bill.payments.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Payments</p>
                              <div className="space-y-2">
                                {bill.payments.map((payment) => (
                                  <div key={payment.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2">
                                    <div className="text-sm">
                                      <p className="text-navy font-medium">
                                        {formatCurrency(Number(payment.amount_paid))}
                                        <span className="text-slate font-normal ml-2 capitalize">
                                          {payment.payment_method.replace('_', ' ')}
                                        </span>
                                      </p>
                                      <p className="text-slate text-xs">
                                        {formatDateTime(payment.paid_at)}
                                        {payment.upi_ref && ` · UTR: ${payment.upi_ref}`}
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      disabled={downloadingId === payment.id}
                                      onClick={async () => {
                                        setDownloadingId(payment.id);
                                        try {
                                          await downloadReceipt({
                                            paymentId: payment.id,
                                            paidAt: payment.paid_at,
                                            tenant: { full_name: tenant.full_name, phone: tenant.phone ?? tenant.email ?? '' },
                                            property: bill.unit.property,
                                            unit: bill.unit,
                                            cycleMonth: bill.cycle?.cycle_month ?? payment.paid_at,
                                            lineItems: bill.line_items.map((li) => ({ description: li.description, amount: li.amount })),
                                            totalAmount: bill.total_amount,
                                            amountPaid: payment.amount_paid,
                                            paymentMethod: payment.payment_method,
                                            upiRef: payment.upi_ref,
                                          });
                                        } catch {
                                          toast.error('Failed to generate receipt');
                                        } finally {
                                          setDownloadingId(null);
                                        }
                                      }}
                                    >
                                      <Download size={13} className="mr-1" />
                                      {downloadingId === payment.id ? 'Generating…' : 'Receipt'}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {bill.payments.length === 0 && (
                            <p className="text-sm text-slate flex items-center gap-1.5">
                              <AlertCircle size={14} /> No payments recorded yet
                            </p>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </Tabs.Content>

          {/* ── Maintenance tab ────────────────────────────────────────────── */}
          <Tabs.Content value="maintenance">
            {!tenantMaintenance || tenantMaintenance.length === 0 ? (
              <EmptyState icon={Wrench} title="No maintenance requests" description="Requests raised by this tenant will appear here." />
            ) : (
              <div className="space-y-2">
                {tenantMaintenance.map((req) => (
                  <Card key={req.id}>
                    <div className="flex items-start gap-3 p-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-medium text-navy">{req.title}</p>
                          <StatusPill status={req.status} />
                        </div>
                        {req.description && (
                          <p className="text-sm text-slate mb-1">{req.description}</p>
                        )}
                        <p className="text-xs text-slate/70">
                          Raised {formatDateTime(req.raised_at)}
                          {req.assigned_to && ` · Assigned to ${req.assigned_to}`}
                          {req.repair_cost && ` · Cost ${formatCurrency(Number(req.repair_cost))}`}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </main>

      <Modal open={showOffboard} onClose={() => setShowOffboard(false)} title="Remove Tenant">
        <p className="text-sm text-slate mb-1">
          Are you sure you want to remove <span className="font-semibold text-navy">{tenant?.full_name}</span>?
        </p>
        <p className="text-sm text-slate mb-6">
          This will terminate any active lease and soft-delete their account. Bills and payment history are preserved.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowOffboard(false)}>Cancel</Button>
          <Button variant="danger" loading={offboard.isLoading} onClick={handleOffboard}>
            <UserX size={14} />
            Remove Tenant
          </Button>
        </div>
      </Modal>
    </div>
  );
}
