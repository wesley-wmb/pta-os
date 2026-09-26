import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FocusedOperationItem } from './focused-operation-item';

const scrollIntoView = vi.fn();

describe('FocusedOperationItem', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    scrollIntoView.mockReset();
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('leva foco ao resultado selecionado e o identifica semanticamente', () => {
    render(
      <ul>
        <FocusedOperationItem id="evento-1" active>
          <article>Campanha de agosto</article>
        </FocusedOperationItem>
      </ul>,
    );

    const item = screen.getByRole('listitem');
    expect(item).toHaveFocus();
    expect(item).toHaveAttribute('aria-current', 'true');
    expect(item).toHaveAttribute('data-search-target', 'true');
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      behavior: 'auto',
    });
  });

  it('mantém itens comuns fora da ordem de foco', () => {
    render(
      <ul>
        <FocusedOperationItem id="evento-2" active={false}>
          <article>Outro evento</article>
        </FocusedOperationItem>
      </ul>,
    );

    const item = screen.getByRole('listitem');
    expect(item).not.toHaveAttribute('tabindex');
    expect(item).not.toHaveAttribute('aria-current');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
