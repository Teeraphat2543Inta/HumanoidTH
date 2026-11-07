import { test, expect } from "@playwright/test";

test("Living Lab page renders the privacy notice, the form and the scorecard", async ({ page }) => {
  const response = await page.goto("/living-lab");
  expect(response?.status()).toBe(200);
  // The splash screen keeps its own <h1> in the DOM, so target this page's heading.
  await expect(page.getByRole("heading", { level: 1, name: "HRI Wellness Living Lab" })).toBeVisible();
  await expect(page.getByTestId("scorecard-table")).toBeVisible();
  await expect(page.getByText("ใช้รหัสแทนตัวตนเท่านั้น")).toBeVisible();
});

test("the form asks for consent before it shows any question", async ({ page }) => {
  await page.goto("/living-lab");
  await expect(page.getByRole("heading", { name: "ความยินยอม" })).toBeVisible();
  await expect(page.getByLabel("รหัสผู้เข้าร่วม")).toHaveCount(0);
  await page.getByRole("button", { name: "ยินดีเข้าร่วม" }).click();
  await expect(page.getByLabel("รหัสผู้เข้าร่วม")).toBeVisible();
});

test("the API rejects a session without consent and one that uses a name as the code", async ({ request }) => {
  const base = {
    robotModelId: "any",
    participantGroup: "older_adult",
    setting: "eldercare_facility",
    activity: "conversation",
    durationMinutes: 20,
    moodBefore: 2,
    moodAfter: 4,
    lonelinessBefore: 4,
    lonelinessAfter: 3,
    trustAfter: 4
  };

  const noConsent = await request.post("/api/living-lab/sessions", {
    data: { ...base, participantCode: "BKK-01", consentConfirmed: false }
  });
  expect(noConsent.status()).toBe(422);
  expect((await noConsent.json()).issues.consentConfirmed).toBeTruthy();

  const named = await request.post("/api/living-lab/sessions", {
    data: { ...base, participantCode: "Somchai Jaidee", consentConfirmed: true }
  });
  expect(named.status()).toBe(422);
  expect((await named.json()).issues.participantCode).toBeTruthy();
});

test("the telemetry endpoint rejects an unsigned request", async ({ request }) => {
  const res = await request.post("/api/living-lab/telemetry", { data: { inventoryId: "x", interactionCount: 1 } });
  expect([401, 503]).toContain(res.status());
});
