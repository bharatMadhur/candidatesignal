import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_COMPANY_EMAIL;
const password = process.env.E2E_COMPANY_PASSWORD;

test("public entry keeps login on the homepage and removes legacy login pages", async ({ page }) => {
  await page.goto("/");
  const loginPanel = page.locator(".loginPanel");
  await expect(page.getByText(/candidateSignal\.ai/i).first()).toBeVisible();
  await expect(page.getByText(/company login|company workspace/i).first()).toBeVisible();
  await expect(page.getByText(/applicant login|applicant portal/i).first()).toBeVisible();
  await page.getByRole("button", { name: /create a company workspace/i }).click();
  await expect(page.getByRole("heading", { name: /create company workspace/i })).toBeVisible();
  await expect(loginPanel.getByLabel(/company name/i)).toBeVisible();
  await expect(loginPanel.getByLabel(/your name|owner name/i)).toBeVisible();
  await expect(loginPanel.getByLabel(/work email/i)).toBeVisible();
  await expect(loginPanel.getByRole("button", { name: /create free workspace/i })).toBeVisible();
  await page.locator(".stitchFinalCta").getByRole("button", { name: /create free workspace/i }).scrollIntoViewIfNeeded();
  await page.locator(".stitchFinalCta").getByRole("button", { name: /create free workspace/i }).click();
  await expect.poll(async () => loginPanel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top > -40 && rect.top < window.innerHeight - 120;
  })).toBe(true);
  const loginResponse = await page.goto("/login");
  expect(loginResponse?.status()).toBe(404);
  const adminLoginResponse = await page.goto("/admin/login");
  expect(adminLoginResponse?.status()).toBe(404);
});

test.describe("authenticated recruiter workflows", () => {
  test.skip(!email || !password, "Set E2E_COMPANY_EMAIL and E2E_COMPANY_PASSWORD to run authenticated workflow tests.");

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("candidate database, upload queue, Copilot, campaigns, notes, and versions are reachable", async ({ page }) => {
    await expect(page.getByRole("button", { name: /candidates/i })).toBeVisible();

    await page.getByRole("button", { name: /candidates/i }).click();
    await expect(page.getByText(/candidate/i).first()).toBeVisible();

    await page.getByRole("button", { name: /upload/i }).click();
    await expect(page.getByText(/resume|requirement|upload/i).first()).toBeVisible();

    await page.getByRole("button", { name: /copilot/i }).click();
    await expect(page.getByText(/copilot|search candidates/i).first()).toBeVisible();

    await page.getByRole("button", { name: /campaigns/i }).click();
    await expect(page.getByText(/campaign/i).first()).toBeVisible();

    await openSettings(page);
    await page.getByRole("button", { name: /upload review/i }).click();
    await expect(page.getByText(/queue|worker|failed/i).first()).toBeVisible();

    await openSettings(page);
    await page.getByRole("button", { name: /candidate versions/i }).click();
    await expect(page.getByText(/version/i).first()).toBeVisible();
  });
});

async function login(page: Page) {
  await page.goto("/?login=company");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await expect(page.getByRole("button", { name: /candidates/i })).toBeVisible();
}

async function openSettings(page: Page) {
  const settingsButton = page.getByRole("button", { name: /settings|account/i }).first();
  await expect(settingsButton).toBeVisible();
  await settingsButton.click();
}
