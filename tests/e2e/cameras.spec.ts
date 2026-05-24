import { test, expect } from '@playwright/test';
import { signIn } from './_helpers';

// Quick helper: hit the running backend directly with Jane's JWT so the
// test can verify server-side state after a UI action.
async function backendFetch(path: string) {
  const token = await fetch(
    'http://127.0.0.1:54341/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      },
      body: JSON.stringify({
        email: 'jane@patel.co',
        password: 'Mar9aret!2024',
      }),
    },
  )
    .then((r) => r.json())
    .then((j) => j.access_token as string);
  return fetch(`http://127.0.0.1:8002${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
}

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

  test('per-camera ON/OFF toggle flips pill + persists to backend', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/cameras');

    // Pick the seeded "Living room" camera row.
    const row = page
      .getByRole('listitem')
      .filter({ hasText: 'Living room' });
    await expect(row).toBeVisible();

    // Toggle is the ON/OFF button — read its initial state.
    const toggle = row.getByRole('button', { name: /^(ON|OFF)$/ });
    const initial = (await toggle.textContent())?.trim() ?? 'ON';

    // Click → opposite state shows up.
    await toggle.click();
    const next = initial === 'ON' ? 'OFF' : 'ON';
    await expect(toggle).toHaveText(next, { timeout: 5_000 });

    // Verify the backend reflects this — pull the cameras list and find
    // the Living room camera, check its `disabled` field matches.
    const cams = (await backendFetch(
      '/v1/patients/775e16d5-b310-4eee-b889-2fc91de27069/cameras',
    )) as Array<{ room: string; disabled: boolean }>;
    const living = cams.find((c) => c.room === 'Living room');
    expect(living).toBeDefined();
    expect(living!.disabled).toBe(next === 'OFF');

    // Toggle back to leave the system clean for other tests.
    await toggle.click();
    await expect(toggle).toHaveText(initial, { timeout: 5_000 });
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
