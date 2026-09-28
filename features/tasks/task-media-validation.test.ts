import { describe, expect, it } from 'vitest';
import { MAX_MEDIA_SIZE, validateTaskMedia } from './task-media-validation';

describe('task media validation', () => {
  it.each(['png', 'mp4', 'mp3', 'pdf', 'docx', 'zip'])(
    'accepts supported %s files',
    (extension) => {
      expect(
        validateTaskMedia({ name: `anexo.${extension}`, size: 12, type: '' }),
      ).not.toHaveProperty('error');
    },
  );
  it.each([0, MAX_MEDIA_SIZE + 1])('rejects invalid size %s', (size) => {
    expect(
      validateTaskMedia({ name: 'anexo.png', size, type: 'image/png' }),
    ).toHaveProperty('error');
  });
  it.each(['arquivo.exe', '../arquivo.png', 'a\\b.png'])(
    'rejects invalid file %s',
    (name) => {
      expect(validateTaskMedia({ name, size: 12, type: '' })).toHaveProperty(
        'error',
      );
    },
  );
  it('accepts the exact size limit and uppercase extensions', () => {
    expect(
      validateTaskMedia({ name: 'Foto.PNG', size: MAX_MEDIA_SIZE, type: '' }),
    ).toEqual({ extension: 'png', mime: 'image/png' });
  });
});
