import { test, expect } from '@playwright/test';
import { loginAs, ACCOUNTS } from './helpers/auth';

test.describe('Authentication Flow', () => {

  test('should show error on invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="name@company.com atau usercode"]', 'wrong@email.com');
    await page.fill('input[placeholder="Enter your password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Cek apakah ada pesan error muncul (menggunakan class container agar lebih kebal)
    const errorMessage = page.locator('.bg-red-50');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should login as admin and navigate to admin dashboard', async ({ page }) => {
    await loginAs(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    
    // Validasi URL dan tampilan Admin
    await expect(page).toHaveURL(/.*\/admin\/dashboard/);
    await expect(page.locator('text=Admin Dashboard').first()).toBeVisible();
  });

});
