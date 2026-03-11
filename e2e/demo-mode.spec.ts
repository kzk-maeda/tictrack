import { test, expect } from "@playwright/test";

test.describe("Demo Mode", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/auth");
    await page.evaluate(() => localStorage.clear());
  });

  test.describe("Demo Mode Entry", () => {
    test("auth page shows demo mode button", async ({ page }) => {
      await page.goto("/auth");

      // Should show demo mode button
      const demoButton = page.locator('button:has-text("デモモード")');
      await expect(demoButton).toBeVisible();
    });

    test("clicking demo button navigates to /demo/timeline", async ({ page }) => {
      await page.goto("/auth");

      // Click demo mode button
      const demoButton = page.locator('button:has-text("デモモード")');
      await demoButton.click();

      // Should navigate to /demo/timeline
      await expect(page).toHaveURL(/\/demo\/timeline/);
    });

    test("sets isDemoMode in localStorage", async ({ page }) => {
      await page.goto("/auth");

      // Click demo mode button
      const demoButton = page.locator('button:has-text("デモモード")');
      await demoButton.click();

      // Wait for navigation
      await page.waitForURL(/\/demo\/timeline/);

      // Check localStorage
      const isDemoMode = await page.evaluate(() => localStorage.getItem("isDemoMode"));
      expect(isDemoMode).toBe("true");
    });
  });

  test.describe("Demo Mode Navigation", () => {
    test("demo banner is visible on demo pages", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Should show demo banner
      await expect(page.locator('text=Demo Mode')).toBeVisible();
      await expect(page.locator('text=Data is read-only')).toBeVisible();
    });

    test("all navigation links have /demo prefix", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Check navigation links
      const timelineLink = page.locator('a[href="/demo/timeline"]');
      const eventsLink = page.locator('a[href="/demo/events"]');
      const dashboardLink = page.locator('a[href="/demo/dashboard"]');
      const settingsLink = page.locator('a[href="/demo/settings"]');

      await expect(timelineLink).toBeVisible();
      await expect(eventsLink).toBeVisible();
      await expect(dashboardLink).toBeVisible();
      await expect(settingsLink).toBeVisible();
    });

    test("clicking Events tab maintains demo mode", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Click Events tab
      const eventsLink = page.locator('a[href="/demo/events"]');
      await eventsLink.click();

      // Should navigate to /demo/events
      await expect(page).toHaveURL(/\/demo\/events/);

      // Demo banner should still be visible
      await expect(page.locator('text=Demo Mode')).toBeVisible();
    });

    test("clicking Dashboard tab maintains demo mode", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Click Dashboard tab
      const dashboardLink = page.locator('a[href="/demo/dashboard"]');
      await dashboardLink.click();

      // Should navigate to /demo/dashboard
      await expect(page).toHaveURL(/\/demo\/dashboard/);

      // Demo banner should still be visible
      await expect(page.locator('text=Demo Mode')).toBeVisible();
    });

    test("clicking Settings tab maintains demo mode", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Click Settings tab
      const settingsLink = page.locator('a[href="/demo/settings"]');
      await settingsLink.click();

      // Should navigate to /demo/settings
      await expect(page).toHaveURL(/\/demo\/settings/);

      // Demo banner should still be visible
      await expect(page.locator('text=Demo Mode')).toBeVisible();
    });

    test("navigating between tabs preserves demo mode", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Navigate: Timeline -> Events -> Dashboard -> Timeline
      await page.locator('a[href="/demo/events"]').click();
      await expect(page).toHaveURL(/\/demo\/events/);

      await page.locator('a[href="/demo/dashboard"]').click();
      await expect(page).toHaveURL(/\/demo\/dashboard/);

      await page.locator('a[href="/demo/timeline"]').click();
      await expect(page).toHaveURL(/\/demo\/timeline/);

      // Demo banner should still be visible
      await expect(page.locator('text=Demo Mode')).toBeVisible();
    });
  });

  test.describe("Demo Mode Exit", () => {
    test("exit button redirects to /auth", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Click exit demo mode button
      const exitButton = page.locator('button:has-text("Exit Demo Mode")');
      await exitButton.click();

      // Should navigate to /auth
      await expect(page).toHaveURL(/\/auth/);
    });

    test("exit button clears isDemoMode from localStorage", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Set demo mode in localStorage
      await page.evaluate(() => localStorage.setItem("isDemoMode", "true"));

      // Click exit button
      const exitButton = page.locator('button:has-text("Exit Demo Mode")');
      await exitButton.click();

      // Wait for navigation
      await page.waitForURL(/\/auth/);

      // Check localStorage
      const isDemoMode = await page.evaluate(() => localStorage.getItem("isDemoMode"));
      expect(isDemoMode).toBeNull();
    });
  });

  test.describe("Demo Mode UI Restrictions", () => {
    test("Record Video button is hidden in demo mode", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Record Video button should not be visible
      const recordButton = page.locator('button:has-text("Record Video")');
      await expect(recordButton).not.toBeVisible();
    });

    test("logout button is hidden in demo mode", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Logout button should not be visible
      const logoutButton = page.locator('button:has-text("Logout")');
      await expect(logoutButton).not.toBeVisible();
    });

    test("user email is not displayed in demo mode", async ({ page }) => {
      await page.goto("/demo/timeline");

      // User email should not be visible (no authenticated user)
      const emailElements = page.locator('text=@');
      await expect(emailElements).not.toBeVisible();
    });
  });

  test.describe("Demo Mode Direct Access", () => {
    test("/demo/timeline is accessible without authentication", async ({ page }) => {
      await page.goto("/demo/timeline");

      // Should load without redirecting to /auth
      await expect(page).toHaveURL(/\/demo\/timeline/);
      await expect(page.locator('text=Demo Mode')).toBeVisible();
    });

    test("/demo/events is accessible without authentication", async ({ page }) => {
      await page.goto("/demo/events");

      await expect(page).toHaveURL(/\/demo\/events/);
      await expect(page.locator('text=Demo Mode')).toBeVisible();
    });

    test("/demo/dashboard is accessible without authentication", async ({ page }) => {
      await page.goto("/demo/dashboard");

      await expect(page).toHaveURL(/\/demo\/dashboard/);
      await expect(page.locator('text=Demo Mode')).toBeVisible();
    });

    test("/demo/settings is accessible without authentication", async ({ page }) => {
      await page.goto("/demo/settings");

      await expect(page).toHaveURL(/\/demo\/settings/);
      await expect(page.locator('text=Demo Mode')).toBeVisible();
    });
  });

  test.describe("Demo Mode i18n Support", () => {
    test("demo banner shows in Japanese", async ({ page }) => {
      await page.goto("/demo/timeline");
      await page.locator('button:has-text("JA")').click();

      // Should show Japanese text
      await expect(page.locator('text=デモモード')).toBeVisible();
      await expect(page.locator('text=データは読み取り専用です')).toBeVisible();
    });

    test("demo banner shows in English", async ({ page }) => {
      await page.goto("/demo/timeline");
      await page.locator('button:has-text("EN")').click();

      // Should show English text
      await expect(page.locator('text=Demo Mode')).toBeVisible();
      await expect(page.locator('text=Data is read-only')).toBeVisible();
    });
  });
});
