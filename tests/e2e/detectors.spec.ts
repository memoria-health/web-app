import { test, expect } from '@playwright/test';
import { signIn } from './_helpers';

test.describe('detectors', () => {
  test('list shows preset detectors with ON/OFF toggles', async ({ page }) => {
    await signIn(page);
    await page.goto('/detectors');
    await expect(
      page.getByRole('heading', { name: 'Detectors' }),
    ).toBeVisible();
    await expect(page.getByText('BUILT-IN', { exact: true })).toBeVisible();
    // Seed creates "Falls" preset detector.
    const fallsRow = page
      .getByRole('listitem')
      .filter({ hasText: 'Falls' });
    await expect(fallsRow).toBeVisible();
    await expect(
      fallsRow.getByRole('button', { name: /(ON|OFF)/ }),
    ).toBeVisible();
  });

  test('toggle a detector off then back on', async ({ page }) => {
    await signIn(page);
    await page.goto('/detectors');
    const row = page.getByRole('listitem').filter({ hasText: 'Falls' });
    const toggle = row.getByRole('button', { name: /(ON|OFF)/ });

    const initial = (await toggle.textContent())?.trim();
    await toggle.click();
    await expect(toggle).toHaveText(initial === 'ON' ? 'OFF' : 'ON', {
      timeout: 5_000,
    });
    // Toggle back to original.
    await toggle.click();
    await expect(toggle).toHaveText(initial ?? 'ON', { timeout: 5_000 });
  });

  test('create + delete a custom detector', async ({ page }) => {
    await signIn(page);
    await page.goto('/detectors/new');

    const name = `e2e-${Date.now().toString().slice(-6)}`;
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Description').fill('Created by Playwright E2E');
    await page
      .getByLabel('Detection prompt')
      .fill('Flag anything weird that happens in the room.');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should redirect back to /detectors and the new row should show.
    await page.waitForURL(/\/detectors(\?|$)/);
    const row = page.getByRole('listitem').filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 5_000 });

    // Click "Edit" → delete from edit page.
    await row.getByRole('link', { name: 'Edit' }).click();
    await page.waitForURL(/\/detectors\/[a-f0-9-]+/);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL(/\/detectors(\?|$)/);
    await expect(page.getByText(name)).toHaveCount(0, { timeout: 5_000 });
  });
});
