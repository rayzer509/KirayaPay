'use client';

import { useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function TenantMaintenancePage() {
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const { data: requests, isLoading, refetch } = trpc.maintenance.list.useQuery({ status: 'all' });
  const { data: leases } = trpc.leases.list.useQuery({ status: 'active' });
  const createMut = trpc.maintenance.create.useMutation();

  const unitOptions = (leases ?? []).map((l) => ({
    value: l.unit_id,
    label: `${l.unit.unit_number} — ${l.unit.property.name}`,
  }));

  async function handleCreate() {
    if (!title.trim()) return toast.error('Enter a title');
    if (!selectedUnit) return toast.error('Select a unit');
    try {
      await createMut.mutateAsync({ unit_id: selectedUnit, title: title.trim(), description: description || undefined });
      toast.success('Request submitted — your landlord will be notified');
      setShowNew(false);
      setTitle(''); setDescription('');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    }
  }

  return (
    <div className="lg:ml-48 p-4 lg:p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">Maintenance Requests</h1>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4" />
          Raise Request
        </Button>
      </div>

      {isLoading && <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />)}</div>}

      {!isLoading && requests?.length === 0 && (
        <EmptyState icon={Wrench} title="No requests yet" description="Raise a maintenance request for any issue in your unit" />
      )}

      {!isLoading && requests && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-navy text-sm truncate">{req.title}</h3>
                    <StatusPill status={req.status} />
                  </div>
                  {req.description && <p className="text-sm text-slate line-clamp-2">{req.description}</p>}
                  <p className="text-xs text-slate mt-1">{formatDateTime(req.raised_at)}</p>
                  {req.assigned_to && <p className="text-xs text-saffron mt-0.5">Assigned to: {req.assigned_to}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Raise Maintenance Request">
        <div className="space-y-4">
          {unitOptions.length > 0 && (
            <Select label="Unit" value={selectedUnit} onValueChange={setSelectedUnit} options={unitOptions} placeholder="Select unit…" />
          )}
          <Input label="Issue Title" placeholder="Leaking tap in bathroom" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Description (optional)" placeholder="Water dripping from the mixer tap near the sink…" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMut.isLoading}>Submit Request</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
