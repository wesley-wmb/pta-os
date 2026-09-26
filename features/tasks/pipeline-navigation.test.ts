import { describe, expect, it } from 'vitest';

import {
  buildPipelineViewLocation,
  buildWeeklyPresentationLocation,
} from './pipeline-navigation';

describe('navegação do pipeline', () => {
  it.each([
    ['table', 'tabela'],
    ['kanban', 'kanban'],
  ] as const)(
    'troca a Central de demandas para %s e remove o estado de planejamento',
    (view, queryValue) => {
      expect(
        buildPipelineViewLocation({
          pathname: '/demandas',
          currentSearch:
            'visao=semana&formato=calendario&data=2026-08-24&origem=atalho',
          view,
          referenceDate: '2026-08-24',
        }),
      ).toBe(`/demandas?visao=${queryValue}&origem=atalho`);
    },
  );

  it.each([
    ['week', 'semana'],
    ['list', 'lista'],
    ['calendar', 'calendario'],
  ] as const)(
    'troca Minha semana para %s e mantém data e parâmetros independentes',
    (format, queryValue) => {
      expect(
        buildWeeklyPresentationLocation({
          pathname: '/demandas',
          currentSearch: 'visao=tabela&origem=atalho',
          format,
          referenceDate: '2026-08-24',
        }),
      ).toBe(
        `/demandas?visao=semana&origem=atalho&formato=${queryValue}&data=2026-08-24`,
      );
    },
  );

  it('atualiza a referência ao navegar pelo período semanal', () => {
    expect(
      buildWeeklyPresentationLocation({
        pathname: '/demandas',
        currentSearch:
          'visao=semana&formato=lista&data=2026-08-24&responsavel=eu',
        format: 'list',
        referenceDate: '2026-08-31',
      }),
    ).toBe(
      '/demandas?visao=semana&formato=lista&data=2026-08-31&responsavel=eu',
    );
  });
});
