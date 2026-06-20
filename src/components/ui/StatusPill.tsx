import { cn } from '@/lib/utils';

type Status = 'paid' | 'partial' | 'pending' | 'sent' | 'overdue' | 'draft' | 'vacant' | 'occupied' | 'active' | 'inactive' | 'expired' | 'terminated' | 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'bills_generated' | 'readings_complete';

const STATUS_MAP: Record<Status, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-sage-light text-sage' },
  partial: { label: 'Partial', className: 'bg-saffron-light text-saffron' },
  pending: { label: 'Pending', className: 'bg-saffron-light text-saffron' },
  sent: { label: 'Due', className: 'bg-saffron-light text-saffron' },
  overdue: { label: 'Overdue', className: 'bg-coral-light text-coral' },
  draft: { label: 'Draft', className: 'bg-slate-light text-slate' },
  vacant: { label: 'Vacant', className: 'bg-slate-light text-slate' },
  occupied: { label: 'Occupied', className: 'bg-sage-light text-sage' },
  active: { label: 'Active', className: 'bg-sage-light text-sage' },
  inactive: { label: 'Inactive', className: 'bg-slate-light text-slate' },
  expired: { label: 'Expired', className: 'bg-slate-light text-slate' },
  terminated: { label: 'Terminated', className: 'bg-coral-light text-coral' },
  open: { label: 'Open', className: 'bg-coral-light text-coral' },
  assigned: { label: 'Assigned', className: 'bg-saffron-light text-saffron' },
  in_progress: { label: 'In Progress', className: 'bg-saffron-light text-saffron' },
  resolved: { label: 'Resolved', className: 'bg-sage-light text-sage' },
  closed: { label: 'Closed', className: 'bg-slate-light text-slate' },
  bills_generated: { label: 'Bills Generated', className: 'bg-sage-light text-sage' },
  readings_complete: { label: 'Readings Done', className: 'bg-saffron-light text-saffron' },
};

export function StatusPill({ status, label, className }: { status: string; label?: string; className?: string }) {
  const config = STATUS_MAP[status as Status] ?? { label: status, className: 'bg-slate-light text-slate' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className, className)}>
      {label ?? config.label}
    </span>
  );
}
