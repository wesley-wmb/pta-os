import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('shows a safe local setup state when Supabase env is absent', async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1',
    'This setup state only exists in the isolated environment without Supabase.',
  );

  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: 'Falta iniciar o banco local.' }),
  ).toBeVisible();
  await expect(page.getByText('Docker Desktop necessário')).toBeVisible();
  await expect(page.getByText('pnpm db:start')).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('has no horizontal page overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});
