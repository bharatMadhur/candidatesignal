import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_COMPANY_EMAIL;
const password = process.env.E2E_COMPANY_PASSWORD;
const stagingGatePassword = process.env.E2E_STAGING_GATE_PASSWORD;

test("public entry keeps login on the homepage and removes legacy login pages", async ({ page }) => {
  await unlockStagingGate(page);
  await page.goto("/");
  const loginPanel = page.locator(".loginPanel");
  await expect(page.getByText(/candidateSignal\.ai/i).first()).toBeVisible();
  await expect(page.getByText(/recruiter login|recruiter workspace/i).first()).toBeVisible();
  await expect(page.getByText(/candidate access|candidate portal/i).first()).toBeVisible();
  await page.getByRole("button", { name: /create a recruiter workspace/i }).click();
  await expect(page.getByRole("heading", { name: /create recruiter workspace/i })).toBeVisible();
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
    await unlockStagingGate(page);
    await login(page);
  });

  test("candidate database, upload queue, Copilot, campaigns, notes, and versions are reachable", async ({ page }) => {
    await expect(navButton(page, "Candidates")).toBeVisible();

    await navButton(page, "Candidates").click();
    await expect(page.getByText(/candidate/i).first()).toBeVisible();

    await navButton(page, "Upload").click();
    await expect(page.getByText(/resume|requirement|upload/i).first()).toBeVisible();

    await navButton(page, "Copilot").click();
    await expect(page.getByText(/copilot|search candidates/i).first()).toBeVisible();

    await navButton(page, "Campaigns").click();
    await expect(page.getByText(/campaign/i).first()).toBeVisible();

    await openSettings(page);
    await settingsPanel(page).getByRole("button", { name: /upload review/i }).click();
    await expect(page.getByText(/queue|worker|failed/i).first()).toBeVisible();

    await openSettings(page);
    await settingsPanel(page).getByRole("button", { name: /candidate versions/i }).click();
    await expect(page.getByText(/version/i).first()).toBeVisible();
  });
});

async function unlockStagingGate(page: Page) {
  if (!stagingGatePassword) return;
  await page.goto("/staging-gate");
  await page.getByLabel(/staging password/i).fill(stagingGatePassword);
  await page.getByRole("button", { name: /continue to staging/i }).click();
  await expect(page).toHaveURL(/\/(?:\?|$)/);
}

async function login(page: Page) {
  await page.goto("/?login=company");
  const loginPanel = page.locator(".loginPanel");
  await loginPanel.getByLabel(/email/i).fill(email!);
  await loginPanel.getByLabel(/password/i).fill(password!);
  await loginPanel.getByRole("button", { name: /enter recruiter workspace|recruiter login|sign in/i }).click();
  await expect(navButton(page, "Candidates")).toBeVisible();
}

async function openSettings(page: Page) {
  const menu = page.locator("details.accountMenu").first();
  const settingsSummary = menu.locator("summary.settingsSummary");
  await expect(settingsSummary).toBeVisible();
  const isOpen = await menu.evaluate((element) => element.hasAttribute("open"));
  if (!isOpen) await settingsSummary.click();
}

function navButton(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

function settingsPanel(page: Page) {
  return page.locator("details.accountMenu[open] .accountMenuPanel").first();
}
