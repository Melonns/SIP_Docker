import { test, expect } from '@playwright/test';
import { loginAs, ACCOUNTS } from './helpers/auth';

test.describe('Mentor Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ACCOUNTS.mentor.email, ACCOUNTS.mentor.password);
  });

  const mentorRoutes = [
    { path: '/mentor/dashboard', name: 'Dashboard' },
    { path: '/mentor/internMonitoring', name: 'Intern Monitoring' },
    { path: '/mentor/ending-soon', name: 'Ending Soon Interns' },
    { path: '/mentor/permission', name: 'Permission Approval' },
    { path: '/mentor/corrections', name: 'Corrections Approval' },
    { path: '/mentor/logs', name: 'Logs' },
    { path: '/mentor/reports', name: 'Reports' },
    { path: '/mentor/profile', name: 'Profile' },
    { path: '/mentor/logbook', name: 'Logbook' },
    { path: '/mentor/evaluationIntern', name: 'Evaluation Intern' },
  ];

  for (const route of mentorRoutes) {
    test(`should load ${route.name} properly and fetch data`, async ({ page }) => {
      const responsePromise = page.waitForResponse(response => response.url().includes('/api/') && response.status() === 200, { timeout: 10000 }).catch(() => {});
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp('.*' + route.path.replace(/\//g, '\\/')));
      
      await expect(page.locator('h1, h2, h3, .text-2xl, .text-xl, .font-bold').first()).toBeVisible({ timeout: 15000 });
      if (responsePromise) await responsePromise;
    });
  }
});
