export async function loginAs(page, email, password) {
  await page.goto('/login');
  await page.fill('input[placeholder="name@company.com atau usercode"]', email);
  await page.fill('input[placeholder="Enter your password"]', password);
  await page.click('button[type="submit"]');
  // Tunggu URL berubah mengandung dashboard
  await page.waitForURL('**/dashboard');
}

export const ACCOUNTS = {
  admin: { email: 'admin@internhub.com', password: 'admin123' },
  mentor: { email: 'dewi@internhub.com', password: 'mentor123' },
  intern: { email: 'alvian@gmail.com', password: 'alvian123' },
};
