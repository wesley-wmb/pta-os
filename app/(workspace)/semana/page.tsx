import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Tarefas' };

export default async function WeekPage() {
  redirect('/demandas?visao=semana');
}
