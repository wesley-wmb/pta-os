import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TimelinePhaseBar, shiftPhaseDates } from './timeline-phase-bar';
const dates = { startDate: '2026-09-26', endDate: '2026-09-30' };
const phase = {
  id: 'phase',
  name: 'Captação',
  color: 'blue',
  position: 1,
  version: 4,
  ...dates,
};
afterEach(cleanup);
function setup(
  onChange = vi.fn().mockResolvedValue(undefined),
  canManage = true,
) {
  const edit = vi.fn();
  render(
    <TimelinePhaseBar
      phase={phase}
      {...dates}
      rangeStart={new Date(2026, 8, 20)}
      dayWidth={32}
      canvasWidth={1500}
      top={6}
      color="#4488ff"
      canManage={canManage}
      onEdit={edit}
      onChange={onChange}
    />,
  );
  return { onChange, edit };
}
it('move o período mantendo duração e impede inverter início e fim', () => {
  expect(shiftPhaseDates(dates, 'move', 5)).toEqual({
    startDate: '2026-10-01',
    endDate: '2026-10-05',
  });
  expect(shiftPhaseDates(dates, 'start', 20)).toEqual({
    startDate: dates.endDate,
    endDate: dates.endDate,
  });
  expect(shiftPhaseDates(dates, 'end', -20)).toEqual({
    startDate: dates.startDate,
    endDate: dates.startDate,
  });
});
it('redimensiona pelo teclado usando a versão original da fase', async () => {
  const { onChange } = setup();
  fireEvent.keyDown(
    screen.getByRole('button', { name: 'Alterar fim da fase Captação' }),
    { key: 'ArrowRight', shiftKey: true },
  );
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(phase, '2026-09-26', '2026-10-07'),
  );
});
it('arrasta a borda e não abre o editor ao soltar', async () => {
  const { onChange, edit } = setup();
  const handle = screen.getByRole('button', {
    name: 'Alterar início da fase Captação',
  });
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 132 });
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 132 });
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(phase, '2026-09-27', '2026-09-30'),
  );
  expect(edit).not.toHaveBeenCalled();
});
it('cancela com Escape sem persistir', () => {
  const { onChange } = setup();
  const handle = screen.getByRole('button', {
    name: 'Alterar fim da fase Captação',
  });
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 164 });
  fireEvent.keyDown(handle, { key: 'Escape' });
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 164 });
  expect(onChange).not.toHaveBeenCalled();
});
it('não disponibiliza alteração sem permissão', () => {
  setup(undefined, false);
  expect(
    screen.queryByRole('button', { name: 'Alterar fim da fase Captação' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button')).toBeDisabled();
});
it('restaura as datas quando o servidor rejeita a gravação', async () => {
  setup(vi.fn().mockRejectedValue(new Error('PTA_VERSION_CONFLICT')));
  fireEvent.keyDown(
    screen.getByRole('button', { name: 'Alterar fim da fase Captação' }),
    { key: 'ArrowRight' },
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /Editar fase/ }),
    ).toHaveAccessibleName(
      'Editar fase Captação, de 2026-09-26 até 2026-09-30.',
    ),
  );
});
