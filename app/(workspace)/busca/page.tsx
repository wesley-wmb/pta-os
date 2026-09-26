import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SearchPageContent } from '@/features/search/search-page-content';
import { searchWorkspaceOnServer } from '@/features/search/server';
import { getWorkspaceContext } from '@/features/workspace/server';

export const metadata: Metadata = { title: 'Busca global' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const context = await getWorkspaceContext();
  if (!context?.workspace) redirect('/login');

  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? '').trim().slice(0, 100);

  if (query.length < 2) {
    return <SearchPageContent query={query} payload={null} />;
  }

  let payload = null;
  let failed = false;
  try {
    payload = await searchWorkspaceOnServer(context.workspace.id, query, 20);
  } catch {
    failed = true;
  }

  return <SearchPageContent query={query} payload={payload} failed={failed} />;
}
