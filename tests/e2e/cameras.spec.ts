import { test, expect } from '@playwright/test';
import { signIn } from './_helpers';

test.describe('cameras', () => {
  test('list shows seeded cameras', async ({ page }) => {
    await signIn(page);
    await page.goto('/cameras');
    await expect(
      page.getByRole('heading', { name: 'Cameras' }),
    ).toBeVisible();
    // Seed data creates Living room, Kitchen, Bedroom.
    await expect(page.getByText('Living room', { exact: true })).toBeVisible();
    await expect(page.getByText('Kitchen', { exact: true })).toBeVisible();
    await expect(page.getByText('Bedroom', { exact: true })).toBeVisible();
  });

  test('add camera flow shows a 6-digit pairing code', async ({ page }) => {
    await signIn(page);
    await page.goto('/cameras/new');
    await expect(
      page.getByRole('heading', { name: 'Add camera' }),
    ).toBeVisible();

    const name = `E2E test ${Date.now().toString().slice(-6)}`;
    await page.getByLabel('Camera name').fill(name);
    await page.getByRole('button', { name: 'Generate code' }).click();

    // Wait for the pairing code element to render.
    const codeEl = page.locator('[aria-label^="pairing code"]');
    await expect(codeEl).toBeVisible({ timeout: 10_000 });
    const text = (await codeEl.textContent()) ?? '';
    expect(text.replace(/\s/g, '')).toMatch(/^\d{6}$/);

    // Clean up — remove the test camera so re-runs don't pile up rows.
    await page.goto('/cameras');
    page.once('dialog', (d) => d.accept());
    await page
      .getByRole('listitem')
      .filter({ hasText: name })
      .getByRole('button', { name: /remove/i })
      .click();
    await expect(page.getByText(name)).toHaveCount(0, { timeout: 5_000 });
  });
});
