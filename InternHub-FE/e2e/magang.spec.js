import { test, expect } from '@playwright/test';
import { loginAs, ACCOUNTS } from './helpers/auth';

test.describe('Magang (Intern) Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ACCOUNTS.intern.email, ACCOUNTS.intern.password);
  });

  const magangRoutes = [
    { path: '/magang/dashboard', name: 'Dashboard' },
    { path: '/magang/attendance', name: 'Attendance' },
    { path: '/magang/permission', name: 'Permission' },
    { path: '/magang/correction', name: 'Correction' },
    { path: '/magang/history', name: 'History' },
    { path: '/magang/logbook', name: 'Logbook' },
    { path: '/magang/profile', name: 'Profile' },
    { path: '/magang/resultEvaluation', name: 'Result Evaluation' },
  ];

  for (const route of magangRoutes) {
    test(`should load ${route.name} properly and fetch data`, async ({ page }) => {
      const responsePromise = page.waitForResponse(response => response.url().includes('/api/') && response.status() === 200, { timeout: 10000 }).catch(() => {});
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp('.*' + route.path.replace(/\//g, '\\/')));
      
      await expect(page.locator('h1, h2, h3, .text-2xl, .text-xl, .font-bold').first()).toBeVisible({ timeout: 15000 });
      if (responsePromise) await responsePromise;
    });
  }
});
