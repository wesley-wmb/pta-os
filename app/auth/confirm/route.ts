import { type NextRequest, NextResponse } from 'next/server';

import {
  safeAuthReturnPath,
  safeRecoveryReturnPath,
} from '@/features/auth/return-path';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get('code');
  const flowId = url.searchParams.get('sb_flow_id');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const requestedNext = url.searchParams.get('next');
  const next = code
    ? safeAuthReturnPath(requestedNext)
    : safeRecoveryReturnPath(requestedNext);
  const supabase = await createClient();

  let error: unknown;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    ));
  } else if (tokenHash && type === 'recovery') {
    ({ error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    }));
  } else {
    error = new Error('PTA_AUTH_CONFIRMATION_MISSING_TOKEN');
  }

  url.pathname = error ? '/recuperar-senha' : next;
  url.search = error ? '?erro=link-invalido' : '';

  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
