import { expect, test, type Page } from "@playwright/test";

const candidateEmail = process.env.E2E_CANDIDATE_EMAIL || (process.env.E2E_BASE_URL ? "" : "candidate@example.com");
const candidatePassword = process.env.E2E_CANDIDATE_PASSWORD || (process.env.E2E_BASE_URL ? "" : "resume-intel");
const stagingGatePassword = process.env.E2E_STAGING_GATE_PASSWORD;

test("candidate login exposes Google access", async ({ page }) => {
  await unlockStagingGate(page);
  await page.goto("/?login=candidate");
  await expect(page.locator(".loginPanel").getByRole("button", { name: /continue with google/i })).toBeVisible();
});

test.describe("candidate portal workflows", () => {
  test.skip(!candidateEmail || !candidatePassword, "Set E2E_CANDIDATE_EMAIL and E2E_CANDIDATE_PASSWORD to run candidate portal tests against external environments.");

  test.beforeEach(async ({ page }) => {
    await unlockStagingGate(page);
    await loginCandidate(page);
  });

  test("resume home, version review, editor, and job board remain reachable", async ({ page }) => {
    await expect(page.getByRole("button", { name: /home/i })).toBeVisible();
    await expect(page.getByText(/resume you control|candidateSignal native/i).first()).toBeVisible();

    await navButton(page, "My Resumes").click();
    await expect(page.getByText(/application vault|resume versions/i).first()).toBeVisible();

    const firstVersion = page.locator(".candidateVersionTable .tableRow").nth(1);
    if (await firstVersion.count()) {
      await firstVersion.getByRole("button", { name: /^Edit$/i }).click();
      await expect(page.getByRole("dialog", { name: /resume version editor/i })).toBeVisible();
      await expect(page.locator(".candidateTiptapEditor .ProseMirror")).toBeVisible();
      await expect(page.getByText(/AI resume editor/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /review whole resume/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /export pdf/i })).toBeVisible();
      await page.getByRole("button", { name: /close/i }).click();
    }

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
  return page.getByLabel("Candidate workspace sections").getByRole("button", { name, exact: true });
}
