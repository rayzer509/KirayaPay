'use client';

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { MessageSquare, Send } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function MessagesPage() {
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [message, setMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: leases } = trpc.leases.list.useQuery({ status: 'active' });
  const { data: me } = trpc.auth.me.useQuery();
  const { data: thread, refetch } = trpc.messages.thread.useQuery(
    { lease_id: selectedLeaseId },
    { enabled: !!selectedLeaseId, refetchInterval: 5000 }
  );
  const sendMut = trpc.messages.send.useMutation();
  const markRead = trpc.messages.markRead.useMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (selectedLeaseId) markRead.mutate({ lease_id: selectedLeaseId });
  }, [thread?.length, selectedLeaseId]);

  const leaseOptions = (leases ?? []).map((l) => ({
    value: l.id,
    label: `${l.tenant.full_name} — ${l.unit.unit_number}`,
  }));

  async function handleSend() {
    if (!message.trim() || !selectedLeaseId) return;
    try {
      await sendMut.mutateAsync({ lease_id: selectedLeaseId, body: message.trim() });
      setMessage('');
      refetch();
    } catch {
      toast.error('Failed to send');
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Messages" />
      <main className="flex-1 p-6 flex flex-col gap-4">
        <Select
          value={selectedLeaseId}
          onValueChange={setSelectedLeaseId}
          options={leaseOptions}
          placeholder="Select tenant conversation…"
          className="max-w-xs"
        />

        {!selectedLeaseId && (
          <EmptyState icon={MessageSquare} title="Select a tenant" description="Choose a lease above to view the message thread" />
        )}

        {selectedLeaseId && (
          <Card padding="none" className="flex flex-col flex-1 min-h-[400px]">
            <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[500px]">
              {thread?.length === 0 && (
                <p className="text-center text-slate text-sm py-8">No messages yet. Start the conversation.</p>
              )}
              {thread?.map((msg) => {
                const isMe = msg.sender_id === me?.id;
                return (
                  <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-xs lg:max-w-sm rounded-2xl px-4 py-2.5', isMe ? 'bg-navy text-white' : 'bg-slate-light text-navy')}>
                      <p className="text-sm">{msg.body}</p>
                      <p className={cn('text-xs mt-1', isMe ? 'text-white/50' : 'text-slate')}>
                        {msg.sender.full_name} · {formatDateTime(msg.sent_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-border p-3 flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message…"
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron"
              />
              <Button size="icon" onClick={handleSend} loading={sendMut.isLoading}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
