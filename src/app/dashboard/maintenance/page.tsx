'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { Wrench } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MaintenancePage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [newStatus, setNewStatus] = useState<string>('assigned');

  const { data: requests, isLoading, refetch } = trpc.maintenance.list.useQuery({
    status: statusFilter as 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'all',
  });

  const updateMut = trpc.maintenance.update.useMutation();

  const selected = requests?.find((r) => r.id === updating);

  async function handleUpdate() {
    if (!updating) return;
    try {
      await updateMut.mutateAsync({
        id: updating,
        status: newStatus as 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed',
        assigned_to: assignedTo || undefined,
        repair_cost: repairCost ? parseFloat(repairCost) : undefined,
      });
      toast.success('Updated');
      setUpdating(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Maintenance" />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex gap-3 items-center">
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All requests' },
              { value: 'open', label: 'Open' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
            className="w-48"
          />
        </div>

        {isLoading && <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />)}</div>}

        {!isLoading && requests?.length === 0 && (
          <EmptyState icon={Wrench} title="No maintenance requests" description="Tenants can raise requests from their portal" />
        )}

        {!isLoading && requests && requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((req) => (
              <Card key={req.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-navy truncate">{req.title}</h3>
                      <StatusPill status={req.status} />
                    </div>
                    <p className="text-sm text-slate mb-1">{req.unit.unit_number} · {req.unit.property.name}</p>
                    {req.description && <p className="text-sm text-slate/80 line-clamp-2">{req.description}</p>}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate">
                      <span>By: {req.raiser.full_name}</span>
                      <span>Raised: {formatDateTime(req.raised_at)}</span>
                      {req.assigned_to && <span>Assigned to: {req.assigned_to}</span>}
                      {req.repair_cost && <span className="money">Cost: {formatCurrency(Number(req.repair_cost))}</span>}
                    </div>
                  </div>
                  {req.status !== 'closed' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setUpdating(req.id);
                        setAssignedTo(req.assigned_to ?? '');
                        setRepairCost(req.repair_cost ? String(req.repair_cost) : '');
                        setNewStatus(req.status === 'open' ? 'assigned' : req.status === 'assigned' ? 'in_progress' : req.status === 'in_progress' ? 'resolved' : 'closed');
                      }}
                    >
                      Update
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Modal open={!!updating} onClose={() => setUpdating(null)} title={`Update: ${selected?.title ?? ''}`}>
        <div className="space-y-4">
          <Select
            label="Status"
            value={newStatus}
            onValueChange={setNewStatus}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
          <Input label="Assigned to (vendor/person)" placeholder="Ramesh Electricals" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
          <Input label="Repair Cost (₹, optional)" type="number" step="0.01" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setUpdating(null)}>Cancel</Button>
            <Button onClick={handleUpdate} loading={updateMut.isLoading}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
