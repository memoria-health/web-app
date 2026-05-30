import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Next.js 16: middleware.ts was renamed to proxy.ts.
// Runs on every request to refresh the Supabase session cookie and
// gate authenticated routes.

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/privacy',
  '/terms',
  // `/backend/*` is the client-side rewrite to the FastAPI backend.
  // Those requests carry an Authorization: Bearer header (set by
  // NemaraAPI.request via getBrowserSupabase().auth.getSession().access_token)
  // and the backend validates the JWT itself. proxy.ts must NOT
  // intercept these or it 307-redirects them to /login — the browser
  // fetch follows the redirect, receives HTML for the login page, and
  // JSON.parse blows up. Any UI component that fetches via the
  // browser client (e.g. PatientIdentityStatus) silently degrades to
  // its error state.
  '/backend',
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const c of cookies) request.cookies.set(c.name, c.value);
          response = NextResponse.next({ request });
          for (const c of cookies)
            response.cookies.set(c.name, c.value, c.options);
        },
      },
    },
  );

  // Refresh + read user. Don't put logic between createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.delete('next');
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on every path except static assets, images, favicon.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
