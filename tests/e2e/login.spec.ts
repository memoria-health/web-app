import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL ?? 'jane@patel.co';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Mar9aret!2024';

test.describe('auth', () => {
  test('unauthenticated request redirects to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login/);
    await expect(
      page.getByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
  });

  test('signing in lands on the home page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // After successful login we should land on the home (live grid) page
    // which is wrapped by the (app) layout with TopNav.
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 10_000,
    });
    await expect(page.getByText('Nemara', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Live' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cameras' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Detectors' })).toBeVisible();
  });
});
