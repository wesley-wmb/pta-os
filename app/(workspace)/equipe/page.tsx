import { redirect } from 'next/navigation';

export default async function LegacyTeamPage({
  searchParams,
}: {
  searchParams: Promise<{
    membro?: string | string[];
    visao?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const member = Array.isArray(params.membro)
    ? params.membro[0]
    : params.membro;
  const view = Array.isArray(params.visao) ? params.visao[0] : params.visao;
  if (member) query.set('membro', member);
  if (view === 'modelo') query.set('visao', 'modelo');
  const suffix = query.toString();
  redirect(`/pessoas${suffix ? `?${suffix}` : ''}`);
}
