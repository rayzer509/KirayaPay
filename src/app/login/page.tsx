'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState<'credentials' | 'profile'>('credentials');
  const [loading, setLoading] = useState(false);

  const supabase = createSupabaseBrowserClient();

  // Handle hash-based tokens from invite/magic links (@supabase/ssr doesn't auto-process these)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) return;

    // Clear the hash from the URL immediately
    window.history.replaceState(null, '', window.location.pathname);

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(async ({ data: { session }, error }) => {
        if (error || !session) return;
        const { data: dbUser } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (dbUser?.role === 'tenant') router.push('/tenant/set-password');
        else if (dbUser) router.push('/dashboard');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const createProfile = trpc.auth.createProfile.useMutation();

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) return toast.error('Enter email and password');
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.user.email_confirmed_at) {
          toast('Check your email to confirm your account, then sign in.');
          setIsSignUp(false);
        } else if (data.user) {
          const existing = await supabase.from('users').select('id, role').eq('id', data.user.id).single();
          if (existing.data) {
            router.push(existing.data.role === 'tenant' ? '/tenant' : '/dashboard');
          } else {
            setStep('profile');
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const existing = await supabase.from('users').select('id, role').eq('id', data.user.id).single();
        if (existing.data) {
          router.push(existing.data.role === 'tenant' ? '/tenant' : '/dashboard');
        } else {
          setStep('profile');
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function createOwnerProfile() {
    if (!name.trim()) return toast.error('Enter your name');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session lost');
      await createProfile.mutateAsync({
        id: user.id,
        full_name: name.trim(),
        phone: user.phone || undefined,
        email: user.email ?? undefined,
        role: 'owner',
      });
      router.push('/dashboard');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setLoading(false);
    }
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
          <p className="text-slate text-sm">Property management, simplified</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
          {step === 'profile' ? (
            <>
              <h1 className="text-lg font-semibold text-navy mb-1">One last step</h1>
              <p className="text-sm text-slate mb-5">Enter your name to set up your account</p>
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createOwnerProfile()}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-navy placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron text-sm mb-4"
              />
              <button
                onClick={createOwnerProfile}
                disabled={loading || !name.trim()}
                className="w-full py-2.5 rounded-lg bg-saffron hover:bg-saffron/90 text-white font-semibold text-sm transition disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create Account'}
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-navy mb-1">
                {isSignUp ? 'Create account' : 'Sign in'}
              </h1>
              <p className="text-sm text-slate mb-5">
                {isSignUp ? 'For landlords and property managers' : 'Welcome back'}
              </p>

              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-navy placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron text-sm mb-3"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-navy placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron text-sm mb-4"
              />

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-saffron hover:bg-saffron/90 text-white font-semibold text-sm transition disabled:opacity-50"
              >
                {loading ? (isSignUp ? 'Creating…' : 'Signing in…') : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>

              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full mt-3 py-2 text-slate text-sm hover:text-navy transition"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
