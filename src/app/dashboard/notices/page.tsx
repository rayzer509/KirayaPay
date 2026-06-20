'use client';

import { useState } from 'react';
import { Plus, Megaphone } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { Input, Textarea } from '@/components/ui/Input';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function NoticesPage() {
  const [showNew, setShowNew] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [filterProperty, setFilterProperty] = useState('all');
  const [titleEn, setTitleEn] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [titleHi, setTitleHi] = useState('');
  const [bodyHi, setBodyHi] = useState('');

  const { data: properties } = trpc.properties.list.useQuery();
  const { data: notices, isLoading, refetch } = trpc.notices.list.useQuery(
    { property_id: filterProperty === 'all' ? undefined : filterProperty },
    { enabled: true }
  );
  const createNotice = trpc.notices.create.useMutation();

  const propertyOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  async function handleCreate() {
    if (!selectedProperty) return toast.error('Select a property');
    if (!titleEn.trim() || !bodyEn.trim()) return toast.error('Title and body are required');
    try {
      await createNotice.mutateAsync({
        property_id: selectedProperty,
        title_en: titleEn,
        body_en: bodyEn,
        title_hi: titleHi || undefined,
        body_hi: bodyHi || undefined,
      });
      toast.success('Notice sent to all tenants');
      setShowNew(false);
      setTitleEn(''); setBodyEn(''); setTitleHi(''); setBodyHi('');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send notice');
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Notices"
        action={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />
            Send Notice
          </Button>
        }
      />
      <main className="flex-1 p-6 space-y-4">
        <Select
          value={filterProperty}
          onValueChange={setFilterProperty}
          options={[{ value: 'all', label: 'All properties' }, ...propertyOptions]}
          className="max-w-xs"
        />

        {isLoading && <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />)}</div>}

        {!isLoading && notices?.length === 0 && (
          <EmptyState icon={Megaphone} title="No notices sent" description="Send a notice to notify all tenants of a property" />
        )}

        {!isLoading && notices && notices.length > 0 && (
          <div className="space-y-3">
            {notices.map((notice) => (
              <Card key={notice.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-navy mb-0.5">{notice.title_en}</h3>
                    {notice.title_hi && <p className="text-sm text-slate mb-1">{notice.title_hi}</p>}
                    <p className="text-sm text-slate/80">{notice.body_en}</p>
                  </div>
                  <div className="text-right text-xs text-slate shrink-0">
                    <p>{notice.creator.full_name}</p>
                    <p>{formatDateTime(notice.sent_at)}</p>
                    {notice.unit_id ? <p className="text-saffron">Unit specific</p> : <p>All tenants</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Send Notice" size="lg">
        <div className="space-y-4">
          <Select label="Property" value={selectedProperty} onValueChange={setSelectedProperty} options={propertyOptions} placeholder="Select property…" />
          <p className="text-xs font-semibold text-slate uppercase tracking-wide">English</p>
          <Input label="Title (English)" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Water supply interruption" />
          <Textarea label="Body (English)" value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} placeholder="Water supply will be interrupted on…" />
          <p className="text-xs font-semibold text-slate uppercase tracking-wide">हिंदी (optional)</p>
          <Input label="Title (Hindi)" value={titleHi} onChange={(e) => setTitleHi(e.target.value)} placeholder="पानी की आपूर्ति में बाधा" />
          <Textarea label="Body (Hindi)" value={bodyHi} onChange={(e) => setBodyHi(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createNotice.isLoading}>Send to All Tenants</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
