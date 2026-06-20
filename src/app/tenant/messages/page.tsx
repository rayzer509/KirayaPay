'use client';

import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MessageSquare, Send } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function TenantMessagesPage() {
  const [message, setMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: leases } = trpc.leases.list.useQuery({ status: 'active' });
  const { data: me } = trpc.auth.me.useQuery();

  const activeLease = leases?.[0];

  const { data: thread, refetch } = trpc.messages.thread.useQuery(
    { lease_id: activeLease?.id ?? '' },
    { enabled: !!activeLease?.id, refetchInterval: 5000 }
  );
  const sendMut = trpc.messages.send.useMutation();
  const markRead = trpc.messages.markRead.useMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (activeLease?.id) markRead.mutate({ lease_id: activeLease.id });
  }, [thread?.length]);

  async function handleSend() {
    if (!message.trim() || !activeLease) return;
    try {
      await sendMut.mutateAsync({ lease_id: activeLease.id, body: message.trim() });
      setMessage('');
      refetch();
    } catch {
      toast.error('Failed to send');
    }
  }

  if (!activeLease) {
    return (
      <div className="lg:ml-48 p-4 lg:p-6">
        <EmptyState icon={MessageSquare} title="No active lease" description="You need an active lease to message your landlord" />
      </div>
    );
  }

  return (
    <div className="lg:ml-48 flex flex-col h-[calc(100vh-52px)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-surface">
        <h1 className="font-semibold text-navy text-sm">Messages — {activeLease.unit.property.name}</h1>
        <p className="text-xs text-slate">{activeLease.unit.unit_number}</p>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {thread?.length === 0 && (
          <p className="text-center text-slate text-sm py-8">No messages yet. Start the conversation!</p>
        )}
        {thread?.map((msg) => {
          const isMe = msg.sender_id === me?.id;
          return (
            <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5', isMe ? 'bg-navy text-white' : 'bg-slate-light text-navy')}>
                <p className="text-sm">{msg.body}</p>
                <p className={cn('text-xs mt-1', isMe ? 'text-white/50' : 'text-slate')}>
                  {formatDateTime(msg.sent_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-surface flex gap-2 pb-safe">
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
    </div>
  );
}
