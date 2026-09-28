import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { HistoryView } from './history-view';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('exports user-controlled titles and names as text rather than formulas', async () => {
  let exported: Blob | undefined;
  const createObjectURL = vi.fn((blob: Blob) => {
    exported = blob;
    return 'blob:history-test';
  });
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(
    <HistoryView
      data={{
        today: '2026-09-27',
        timezone: 'America/Sao_Paulo',
        activity: [
          {
            id: 'activity-1',
            action: 'task.created',
            actorName: '+SUM(1,2)',
            subjectName: null,
            taskId: 'task-1',
            taskKey: null,
            taskTitle: '=HYPERLINK("https://example.com")',
            taskArchived: true,
            createdAt: '2026-09-27T12:00:00Z',
            dateKey: '2026-09-27',
          },
        ],
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
  expect(exported).toBeDefined();
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(exported!);
  });
  expect(text).toContain('"\'+SUM(1,2)"');
  expect(text).toContain('"\'=HYPERLINK(""https://example.com"")"');
});
