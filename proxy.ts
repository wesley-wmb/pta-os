import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getPublicSupabaseConfig } from '@/lib/supabase/config';

const publicRoutes = new Set(['/login']);

export async function proxy(request: NextRequest) {
  const config = getPublicSupabaseConfig();

  if (!config) {
    return process.env.NODE_ENV === 'development'
      ? NextResponse.next({ request })
      : NextResponse.json(
          { error: 'Serviço temporariamente indisponível.' },
          { status: 503 },
        );
  }

  let response = NextResponse.next({ request });
  const refreshedCookies = new Map<
    string,
    Parameters<typeof response.cookies.set>
  >();
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          refreshedCookies.set(name, [name, value, options]),
        );
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isPublicRoute = publicRoutes.has(request.nextUrl.pathname);

  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url);
    refreshedCookies.forEach((cookie) =>
      redirectResponse.cookies.set(...cookie),
    );
    return redirectResponse;
  }

  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('retorno', request.nextUrl.pathname);
    return redirectWithCookies(loginUrl);
  }

  if (user && request.nextUrl.pathname === '/login') {
    const startUrl = request.nextUrl.clone();
    startUrl.pathname = '/inicio';
    startUrl.search = '';
    return redirectWithCookies(startUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
