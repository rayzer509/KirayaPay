'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    if (password !== confirm) return toast.error('Passwords do not match');

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) return toast.error(error.message);
    toast.success('Password set! Welcome to PropEase.');
    router.push('/tenant');
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-saffron flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="text-2xl font-bold text-navy">PropEase</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-navy mb-1">Set your password</h1>
          <p className="text-sm text-slate mb-5">Choose a password to access your account in the future</p>

          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-navy placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron text-sm mb-3"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-navy placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron text-sm mb-4"
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-saffron hover:bg-saffron/90 text-white font-semibold text-sm transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
