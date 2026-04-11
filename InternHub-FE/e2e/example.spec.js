import { test, expect } from '@playwright/test';

test('has basic elements on load', async ({ page }) => {
  await page.goto('/');

  // Expect the page body to be visible.
  // This is a basic health check that the app loads without a white screen error
  const body = page.locator('body');
  await expect(body).toBeVisible();
});
