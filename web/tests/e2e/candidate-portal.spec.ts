import { expect, test, type Page } from "@playwright/test";

const candidateEmail = process.env.E2E_CANDIDATE_EMAIL || (process.env.E2E_BASE_URL ? "" : "candidate@example.com");
const candidatePassword = process.env.E2E_CANDIDATE_PASSWORD || (process.env.E2E_BASE_URL ? "" : "resume-intel");
const stagingGatePassword = process.env.E2E_STAGING_GATE_PASSWORD;

test.describe("candidate portal workflows", () => {
  test.skip(!candidateEmail || !candidatePassword, "Set E2E_CANDIDATE_EMAIL and E2E_CANDIDATE_PASSWORD to run candidate portal tests against external environments.");

  test.beforeEach(async ({ page }) => {
    await unlockStagingGate(page);
    await loginCandidate(page);
  });

  test("resume home, version review, editor, and job board remain reachable", async ({ page }) => {
    await expect(page.getByRole("button", { name: /home/i })).toBeVisible();
    await expect(page.getByText(/resume you control|candidateSignal native/i).first()).toBeVisible();

    await navButton(page, "Resume").click();
    await expect(page.getByText(/application vault|resume versions/i).first()).toBeVisible();

    const firstVersion = page.locator(".candidateVersionTable .tableRow").nth(1);
    if (await firstVersion.count()) {
      await firstVersion.click();
      await expect(page.getByRole("button", { name: /download pdf/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /copy link/i })).toBeVisible();
      await expect(page.getByText(/version changes/i)).toBeVisible();
      await expect(page.locator(".candidateCvPreview").first()).toBeVisible();
    }

    await navButton(page, "Editor").click();
    await expect(page.getByText(/bullet editor|job-level ai editor/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /save resume/i })).toBeVisible();

    await navButton(page, "Jobs").click();
    await expect(page.getByText(/practical job board|application tracker/i).first()).toBeVisible();
  });
});

async function unlockStagingGate(page: Page) {
  if (!stagingGatePassword) return;
  await page.goto("/staging-gate");
  await page.getByLabel(/staging password/i).fill(stagingGatePassword);
  await page.getByRole("button", { name: /continue to staging/i }).click();
  await expect(page).toHaveURL(/\/(?:\?|$)/);
}

async function loginCandidate(page: Page) {
  await page.goto("/?login=candidate");
  const loginPanel = page.locator(".loginPanel");
  await loginPanel.getByLabel(/email/i).fill(candidateEmail!);
  await loginPanel.getByLabel(/password/i).fill(candidatePassword!);
  await loginPanel.getByRole("button", { name: /enter candidate workspace|candidate login|sign in/i }).click();
  await expect(page.getByRole("button", { name: /home/i })).toBeVisible();
}

function navButton(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}
