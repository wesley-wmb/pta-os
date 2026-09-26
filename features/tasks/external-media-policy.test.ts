import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sourceRoots = ['app', 'components', 'features'].map((directory) =>
  join(process.cwd(), directory),
);

describe('external media policy', () => {
  it('keeps browser code free from Supabase Storage and file inputs', () => {
    const source = sourceRoots
      .flatMap(listSourceFiles)
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
