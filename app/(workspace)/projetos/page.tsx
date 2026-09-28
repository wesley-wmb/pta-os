import { redirect } from 'next/navigation';
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento } = await searchParams;
  if (typeof evento === 'string' && /^[0-9a-f-]{36}$/i.test(evento))
    redirect(`/projetos/${evento}`);
  redirect('/equipes');
}
