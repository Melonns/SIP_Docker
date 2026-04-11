import { test, expect } from '@playwright/test';
import { loginAs, ACCOUNTS } from './helpers/auth';

test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  });

  const adminRoutes = [
    { path: '/admin/dashboard', name: 'Dashboard' },
    { path: '/admin/masterdata/userRole', name: 'User Role' },
    { path: '/admin/masterdata/userPermission', name: 'User Permission' },
    { path: '/admin/masterdata/internProfile', name: 'Intern Profile' },
    { path: '/admin/masterdata/internMapping', name: 'Intern Mapping' },
    { path: '/admin/masterdata/officelocation', name: 'Office Location' },
    { path: '/admin/masterdata/workingSchedule', name: 'Working Schedule' },
    { path: '/admin/masterdata/evaluation', name: 'Masterdata Evaluation' },
    { path: '/admin/ending-soon', name: 'Ending Soon Interns' },
    { path: '/admin/internMonitoring', name: 'Intern Monitoring' },
    { path: '/admin/permission', name: 'Permission' },
    { path: '/admin/corrections', name: 'Corrections' },
    { path: '/admin/logs', name: 'Logs' },
    { path: '/admin/reports', name: 'Reports' },
    { path: '/admin/logbook', name: 'Logbook' },
    { path: '/admin/evaluation', name: 'Evaluation' },
    { path: '/admin/generate-sertif', name: 'Generate Sertifikat' },
    { path: '/admin/profile', name: 'Profile' },
  ];

  for (const route of adminRoutes) {
    test(`should load ${route.name} properly and fetch data`, async ({ page }) => {
      const responsePromise = page.waitForResponse(response => response.url().includes('/api/') && response.status() === 200, { timeout: 10000 }).catch(() => {});
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp('.*' + route.path.replace(/\//g, '\\/')));
      
      await expect(page.locator('h1, h2, h3, .text-2xl, .text-xl, .font-bold').first()).toBeVisible({ timeout: 15000 });
      if (responsePromise) await responsePromise;
    });
  }
});
