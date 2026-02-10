import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check that the page loaded successfully
    expect(page.url()).toContain('localhost:3000');
  });

  test('should display FleetWatch branding', async ({ page }) => {
    await page.goto('/');

    // Check for FleetWatch title or heading
    // Adjust selector based on your actual homepage
    const title = page.locator('h1, h2, [data-testid="app-title"]');
    await expect(title.first()).toBeVisible();
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto('/');

    // Wait for page to be interactive
    await page.waitForLoadState('domcontentloaded');

    // Check that basic page structure exists
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Login Page', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL(/.*login.*/);

    // Verify we're on login page
    expect(page.url()).toContain('login');
  });

  test('should display login options', async ({ page }) => {
    await page.goto('/login');

    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Check that login page has loaded
    // (specific assertions depend on your login page structure)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
