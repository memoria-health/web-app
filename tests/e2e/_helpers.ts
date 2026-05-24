import type { Page } from '@playwright/test';

export const EMAIL = process.env.TEST_EMAIL ?? 'jane@patel.co';
export const PASSWORD = process.env.TEST_PASSWORD ?? 'Mar9aret!2024';

export async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });
}
