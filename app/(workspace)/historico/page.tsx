import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { HistoryView } from '@/features/operations/history-view';
import { getHistoryPageData } from '@/features/operations/server';

export const metadata: Metadata = { title: 'Histórico' };

export default async function HistoryPage() {
  const data = await getHistoryPageData();

  return (
    <div>
      <PageHeader
        eyebrow="Memória da operação"
        title="Histórico"
        description="Registro do que foi feito, por quem e quando."
        width="wide"
      />
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-12 sm:px-8">
        <HistoryView data={data} />
      </div>
    </div>
  );
}
