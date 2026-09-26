import { describe, expect, it } from 'vitest';

import {
  eventFormSchema,
  eventsPageSchema,
  productFormSchema,
} from './portfolio-schemas';

const eventId = '10000000-0000-4000-8000-000000000001';

describe('portfolio operational contracts', () => {
  it('normalizes the database event contract to the UI model', () => {
    const result = eventsPageSchema.parse({
      today: '2026-08-22',
      events: [
        {
          id: eventId,
          name: 'Imersão de agosto',
          status: 'active',
          summary: null,
          product_id: null,
          product_name: null,
          owner_id: null,
          owner_name: null,
          start_date: '2026-08-20',
          end_date: '2026-08-24',
          version: 2,
          updated_at: '2026-08-22T14:00:00+00:00',
          task_count: 8,
          done_task_count: 6,
          open_task_count: 2,
          overdue_task_count: 1,
          progress: 75,
          health: 'attention',
          resource_count: 3,
          team_count: 4,
          milestone_count: 5,
          completed_milestone_count: 2,
        },
      ],
    });

    expect(result.events[0]).toMatchObject({
      id: eventId,
      progress: 75,
      health: 'attention',
      resourceCount: 3,
      milestoneCount: 5,
    });
  });

  it('rejects inverted event dates before mutation', () => {
    const result = eventFormSchema.safeParse({
      name: 'Encontro anual',
      status: 'planning',
      productId: 'none',
      ownerId: 'none',
      startDate: '2026-09-20',
      endDate: '2026-09-10',
      summary: '',
      objective: '',
      successMetric: '',
    });
    expect(result.success).toBe(false);
  });

  it('keeps product copy concise and bounded', () => {
    expect(
      productFormSchema.safeParse({
        name: 'Produto principal',
        status: 'active',
        description: 'Operação contínua.',
        ownerId: 'none',
      }).success,
    ).toBe(true);
    expect(
      productFormSchema.safeParse({
        name: 'A',
        status: 'active',
        description: '',
        ownerId: 'none',
      }).success,
    ).toBe(false);
  });
});
