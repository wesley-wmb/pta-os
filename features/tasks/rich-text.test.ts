import { describe, expect, it } from 'vitest';

import {
  createEmptyTaskDescription,
  hasTaskDescriptionContent,
  isTaskDescription,
  plainTextToTaskDescription,
  taskDescriptionToPlainText,
} from './rich-text';

describe('task rich text', () => {
  it('accepts the Notion-like allowlist', () => {
    const description = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Briefing' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Primeiro ponto' }],
                },
              ],
            },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Arquivo no Drive',
                      marks: [
                        {
                          type: 'link',
                          attrs: {
                            href: 'https://drive.google.com/example',
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            class: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(isTaskDescription(description)).toBe(true);
  });

  it('rejects media nodes, raw html and unsafe links', () => {
    for (const node of [
      { type: 'image', attrs: { src: 'https://example.com/a.png' } },
      { type: 'video', attrs: { src: 'https://example.com/a.mp4' } },
      { type: 'audio', attrs: { src: 'https://example.com/a.mp3' } },
      { type: 'html', content: '<script>alert(1)</script>' },
    ]) {
      expect(isTaskDescription({ type: 'doc', content: [node] })).toBe(false);
    }

    expect(
      isTaskDescription({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Link',
                marks: [
                  { type: 'link', attrs: { href: 'javascript:alert(1)' } },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('converts legacy plain text without losing paragraph boundaries', () => {
    const description = plainTextToTaskDescription('Linha 1\n\nLinha 2');
    expect(taskDescriptionToPlainText(description)).toBe('Linha 1\n\nLinha 2');
    expect(hasTaskDescriptionContent(description)).toBe(true);
    expect(hasTaskDescriptionContent(createEmptyTaskDescription())).toBe(false);
  });
});
