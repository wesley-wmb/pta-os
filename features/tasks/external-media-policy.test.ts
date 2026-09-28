import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sourceRoots = ['app', 'components', 'features'].map((directory) =>
  join(process.cwd(), directory),
);

describe('media boundaries', () => {
  it('keeps uploads confined to the private task attachment flow', () => {
    const source = sourceRoots
      .flatMap(listSourceFiles)
      .filter((file) => !file.endsWith('task-media.tsx'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/\.storage\s*\./);
    expect(source).not.toMatch(/type\s*=\s*["']file["']/);
  });
});

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const file = join(directory, entry);
    if (statSync(file).isDirectory()) return listSourceFiles(file);
    return ['.ts', '.tsx'].includes(extname(file)) ? [file] : [];
  });
}
