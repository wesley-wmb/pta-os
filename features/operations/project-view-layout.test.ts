import { describe, expect, it } from 'vitest';

import {
  defaultProjectViewLayout,
  hideProjectView,
  normalizeProjectViewLayout,
  reorderVisibleProjectViews,
  showProjectView,
  visibleProjectViews,
} from './project-view-layout';

describe('project view layout', () => {
  it('repairs invalid preferences and keeps every known view', () => {
    expect(
      normalizeProjectViewLayout({
        order: ['timeline', 'timeline', 'unknown', 'overview'],
        hidden: ['activity', 'unknown'],
      }),
    ).toEqual({
      order: [
        'timeline',
        'overview',
        'board',
        'list',
        'calendar',
        'resources',
        'team',
        'activity',
        'settings',
      ],
      hidden: ['activity'],
    });
  });

  it('reorders visible views and keeps hidden views out of the sequence', () => {
    const hidden = hideProjectView(defaultProjectViewLayout, 'activity');
    const reordered = reorderVisibleProjectViews(
      hidden,
      'timeline',
      'overview',
    );

    expect(visibleProjectViews(reordered).slice(0, 3)).toEqual([
      'timeline',
      'overview',
      'board',
    ]);
    expect(reordered.order.at(-1)).toBe('activity');
  });

  it('never hides the final visible view', () => {
    const layout = normalizeProjectViewLayout({
      order: defaultProjectViewLayout.order,
      hidden: defaultProjectViewLayout.order.slice(1),
    });

    expect(hideProjectView(layout, 'overview')).toEqual(layout);
  });

  it('restores a hidden view at the end of the visible row', () => {
    const hidden = hideProjectView(defaultProjectViewLayout, 'activity');
    const restored = showProjectView(hidden, 'activity');

    expect(visibleProjectViews(restored).at(-1)).toBe('activity');
    expect(restored.hidden).not.toContain('activity');
  });
});
