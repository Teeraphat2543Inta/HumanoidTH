import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isRoleSimulationEnabled, selfServiceRole, selfServiceUserUpsert, unverifiedRoleCookieValue } from "../lib/user-roles";

function functionBody(file: string, name: string) {
  const source = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} not found in ${file}`);
  const end = source.indexOf("\n}\n", start);
  return source.slice(start, end);
}

test("self service role allows only USER and RESEARCHER", () => {
  assert.equal(selfServiceRole("USER"), "USER");
  assert.equal(selfServiceRole("RESEARCHER"), "RESEARCHER");
  for (const value of ["ADMIN", "admin", " ADMIN", "OWNER", "", null, undefined, 1, ["ADMIN"], { role: "ADMIN" }]) {
    assert.equal(selfServiceRole(value), "USER");
  }
});

test("registering creates an account with a safe role, even when ADMIN is requested", () => {
  const upsert = selfServiceUserUpsert({ email: "a@example.com", name: "A", role: "ADMIN" });
  assert.equal(upsert.create.role, "USER");
  assert.equal(upsert.create.email, "a@example.com");
  assert.equal(selfServiceUserUpsert({ email: "a@example.com", name: "A", role: "RESEARCHER" }).create.role, "RESEARCHER");
});

test("registering with an existing email cannot change its role", () => {
  for (const role of ["ADMIN", "USER", "RESEARCHER"]) {
    assert.equal("role" in selfServiceUserUpsert({ email: "a@example.com", name: "A", role }).update, false);
  }
});

test("a database ADMIN does not get an ADMIN role cookie without the admin login", () => {
  assert.equal(unverifiedRoleCookieValue("ADMIN"), "USER");
  assert.equal(unverifiedRoleCookieValue("RESEARCHER"), "RESEARCHER");
  assert.equal(unverifiedRoleCookieValue("USER"), "USER");
});

test("role simulation is enabled only in development", () => {
  assert.equal(isRoleSimulationEnabled("development"), true);
  for (const nodeEnv of ["production", "test", "", undefined]) {
    assert.equal(isRoleSimulationEnabled(nodeEnv ?? "unset"), false);
  }
});

test("registerAndLoginUser never issues an admin session", () => {
  const body = functionBody("app/actions.ts", "registerAndLoginUser");
  assert.doesNotMatch(body, /setAdminSessionCookie|createAdminSessionToken/);
  assert.match(body, /selfServiceUserUpsert\(/);
  assert.match(body, /unverifiedRoleCookieValue\(user\.role\)/);
  assert.match(body, /cookieStore\.delete\(ADMIN_SESSION_COOKIE\)/);
});

test("loginAsUser stops before touching anything outside development", () => {
  const body = functionBody("app/actions.ts", "loginAsUser");
  const guard = body.indexOf("isRoleSimulationEnabled()");
  assert.notEqual(guard, -1);
  assert.ok(guard < body.indexOf("prisma.user.upsert"));
  assert.ok(guard < body.indexOf("cookies()"));
});

test("the profile page offers no admin role and hides simulators behind the check", () => {
  const source = readFileSync("app/profile/page.tsx", "utf8");
  assert.doesNotMatch(source, /value="ADMIN"/);
  const guard = source.indexOf("isRoleSimulationEnabled() &&");
  assert.notEqual(guard, -1);
  assert.ok(guard < source.indexOf("Login as Administrator"));
});
