import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { CommandDialog } from './command';

afterEach(cleanup);

it('keeps the accessible name and description inside the modal portal', () => {
  render(
    <CommandDialog open>
      <button>Executar</button>
    </CommandDialog>,
  );
  const dialog = screen.getByRole('dialog', { name: 'Paleta de comandos' });
  const description = document.getElementById(
    dialog.getAttribute('aria-describedby')!,
  );
  expect(dialog.contains(screen.getByText('Paleta de comandos'))).toBe(true);
  expect(description?.textContent).toBe('Busque e selecione um comando.');
  expect(dialog.contains(description)).toBe(true);
});
