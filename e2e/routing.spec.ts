import { test, expect } from "@playwright/test";

test.describe("Routing", () => {
  test("/ redirects to /auth when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("/timeline is accessible", async ({ page }) => {
    // Note: This test may require authentication setup
    await page.goto("/timeline");

    // Should not be 404
    const response = await page.goto("/timeline");
    expect(response?.status()).not.toBe(404);

    // Should show timeline page or redirect to auth
    await expect(page).toHaveURL(/\/(timeline|auth)/);
  });

  test("/tic-cards is accessible", async ({ page }) => {
    await page.goto("/tic-cards");

    const response = await page.goto("/tic-cards");
    expect(response?.status()).not.toBe(404);

    await expect(page).toHaveURL(/\/(tic-cards|auth)/);
  });

  test("/settings is accessible", async ({ page }) => {
    await page.goto("/settings");

    const response = await page.goto("/settings");
    expect(response?.status()).not.toBe(404);

    await expect(page).toHaveURL(/\/(settings|auth)/);
  });

  test("/auth page loads correctly", async ({ page }) => {
    await page.goto("/auth");

    // Should be on /auth page
    await expect(page).toHaveURL(/\/auth/);

    // Should show sign in form
    await expect(page.locator("text=TicTrack")).toBeVisible();
  });

  test("/~offline page loads correctly", async ({ page }) => {
    await page.goto("/~offline");

    await expect(page).toHaveURL(/\/~offline/);

    // Should show offline message
    await expect(page.locator("text=Offline")).toBeVisible();
  });
});
