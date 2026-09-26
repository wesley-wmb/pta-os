import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { ProductsView } from '@/features/operations/products-view';
import {
  getOperationsContext,
  getProductsPageData,
} from '@/features/operations/server';

export const metadata: Metadata = { title: 'Produtos' };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    produto?: string | string[];
    modo?: string | string[];
  }>;
}) {
  const [data, context] = await Promise.all([
    getProductsPageData(),
    getOperationsContext(),
  ]);
  const params = await searchParams;
  const requestedId = Array.isArray(params.produto)
    ? params.produto[0]
    : params.produto;
  const selectedProductId = data.products.some(
    (product) => product.id === requestedId,
  )
    ? (requestedId ?? null)
    : null;
  const requestedMode = Array.isArray(params.modo)
    ? params.modo[0]
    : params.modo;

  return (
    <div>
      <PageHeader
        eyebrow="Portfólio de ofertas"
        title="Produtos"
        description="Produtos, projetos, tarefas e recursos no mesmo contexto."
        width="wide"
      />
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-12 sm:px-8">
        <ProductsView
          key={`${selectedProductId ?? 'lista'}-${requestedMode === 'editar' ? 'editar' : 'detalhe'}`}
          data={data}
          workspaceId={context.workspaceId}
          members={context.members}
          taskPrefix={context.taskPrefix}
          canManage={context.canManage}
          selectedProductId={selectedProductId}
          initialMode={requestedMode === 'editar' ? 'edit' : 'detail'}
        />
      </div>
    </div>
  );
}
