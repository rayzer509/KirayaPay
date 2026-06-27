import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/tenant/set-password'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: object) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: object) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!authUser && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (authUser) {
    // Use service-role client for role lookup — bypasses RLS for this internal
    // operation. We already verified the user's identity via getUser() above;
    // the session client's anon-key JWT may not forward correctly through the
    // Edge runtime, causing auth.uid() to return null and RLS to block the row.
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: dbUser } = await adminSupabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .is('deleted_at', null)
      .single();

    const isTenant = dbUser?.role === 'tenant';

    if (pathname === '/login') {
      if (!dbUser) return response; // no profile yet — let login page handle onboarding
      return NextResponse.redirect(new URL(isTenant ? '/tenant' : '/dashboard', request.url));
    }

    // Tenant trying to access admin area
    if (isTenant && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/tenant', request.url));
    }
    // Admin trying to access tenant area
    if (!isTenant && pathname.startsWith('/tenant')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
