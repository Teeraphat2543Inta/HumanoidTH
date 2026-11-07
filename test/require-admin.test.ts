import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { adminLoginRedirectFor, createAdminSessionToken } from "../lib/admin-session";

// Throwaway values used only by this test file.
const secret = "unit-test-only-secret-not-used-anywhere-else";
const env = { ADMIN_BASIC_USER: "admin@example.com", ADMIN_BASIC_PASSWORD: "unit-test-only-admin-password", ADMIN_SESSION_SECRET: secret };

async function withEnv<T>(values: Partial<typeof env>, run: () => Promise<T>) {
  const keys = Object.keys(env) as Array<keyof typeof env>;
  const saved = keys.map((key) => [key, process.env[key]] as const);
  for (const key of keys) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("a valid session passes", async () => {
  const token = await createAdminSessionToken(env.ADMIN_BASIC_USER, { secret });
  assert.equal(await withEnv(env, () => adminLoginRedirectFor(token)), null);
});

test("missing, forged, wrongly signed and expired sessions go to the login page", async () => {
  const wrongKey = await createAdminSessionToken(env.ADMIN_BASIC_USER, { secret: "another-secret-that-is-also-long-enough" });
  const expired = await createAdminSessionToken(env.ADMIN_BASIC_USER, { secret, now: Date.now() - 9 * 60 * 60 * 1000 });
  for (const token of [undefined, "", "true", "forged.signature", wrongKey, expired]) {
    assert.equal(await withEnv(env, () => adminLoginRedirectFor(token)), "/admin-login");
  }
});

test("a valid session is refused while admin is not fully configured", async () => {
  const token = await createAdminSessionToken(env.ADMIN_BASIC_USER, { secret });
  const incomplete = { ADMIN_BASIC_USER: env.ADMIN_BASIC_USER, ADMIN_SESSION_SECRET: secret };
  assert.equal(await withEnv(incomplete, () => adminLoginRedirectFor(token)), "/admin-login?error=not_configured");
});

function source(file: string) {
  return readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function exportedActions(file: string) {
  return [...source(file).matchAll(/^export (?:async )?function (\w+)/gm)].map((match) => match[1]);
}

function assertGuardedFirst(file: string, name: string) {
  const pattern = new RegExp(`export async function ${name}\\([^)]*\\)[^{]*\\{\\n  await requireAdmin\\(\\);\\n`);
  assert.match(source(file), pattern, `${name} must call requireAdmin() first`);
}

const adminActions = {
  "app/actions.ts": ["updateSubmissionStatus", "runDataPull", "upsertSourceRecordAction", "upsertRobotModelAction", "upsertContributionAction", "upsertSubmittedDataAction"],
  "app/map/actions.ts": ["reanalyzeClustersWithGemini"]
};

const openActions = {
  "app/actions.ts": ["createSubmission", "loginAsUser", "registerAndLoginUser", "logoutUser", "adminLoginAction", "setLanguage"],
  "app/map/actions.ts": ["fetchContributionClusters"]
};

test("every admin action checks access as its first step", () => {
  for (const [file, names] of Object.entries(adminActions)) {
    for (const name of names) {
      assertGuardedFirst(file, name);
    }
  }
});

// Every export from a "use server" file can be called from a browser, so a new
// action must be added to one of the lists above on purpose.
test("every exported server action is classified as admin or open", () => {
  for (const file of Object.keys(adminActions) as Array<keyof typeof adminActions>) {
    assert.deepEqual(exportedActions(file).sort(), [...adminActions[file], ...openActions[file]].sort(), file);
  }
});

test("the Gemini analysis cannot be called directly, but the public map can still use it", () => {
  const map = source("app/map/actions.ts");
  assert.doesNotMatch(map, /export async function analyzeClustersWithGemini/);
  assert.match(map, /\nasync function analyzeClustersWithGemini/);
  assert.doesNotMatch(functionBody(map, "fetchContributionClusters"), /requireAdmin/);
});

function functionBody(text: string, name: string) {
  const start = text.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, name);
  return text.slice(start, text.indexOf("\n}\n", start));
}
