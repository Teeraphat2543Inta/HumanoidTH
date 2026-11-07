import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  adminSessionCookieOptions,
  constantTimeEqual,
  createAdminSessionToken,
  verifyAdminSessionToken
} from "../lib/admin-session";
import { middleware } from "../middleware";

// Throwaway value used only by this test file.
const secret = "unit-test-only-secret-not-used-anywhere-else";
const email = "admin@example.com";
const now = 1_800_000_000_000;

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signWith(payload: string, key = secret) {
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}

test("a freshly signed token verifies and carries the email and an 8 hour expiry", async () => {
  const token = await createAdminSessionToken(email, { secret, now });
  const session = await verifyAdminSessionToken(token, { secret, now });
  assert.deepEqual(session, { sub: email, exp: now / 1000 + ADMIN_SESSION_MAX_AGE_SECONDS });
  assert.equal(ADMIN_SESSION_MAX_AGE_SECONDS, 8 * 60 * 60);
});

test("the signature is standard HMAC-SHA256 over the payload", async () => {
  const token = await createAdminSessionToken(email, { secret, now });
  assert.equal(token, signWith(token.split(".")[0]));
});

test("the old forged cookie value is rejected", async () => {
  assert.equal(await verifyAdminSessionToken("true", { secret, now }), null);
});

test("missing and malformed tokens are rejected", async () => {
  for (const token of [undefined, "", ".", "a.", ".b", "a.b.c"]) {
    assert.equal(await verifyAdminSessionToken(token, { secret, now }), null);
  }
});

test("changing the payload invalidates the signature", async () => {
  const token = await createAdminSessionToken(email, { secret, now });
  const signature = token.split(".")[1];
  const forgedPayload = encode({ sub: "attacker@example.com", exp: now / 1000 + 999_999 });
  assert.equal(await verifyAdminSessionToken(`${forgedPayload}.${signature}`, { secret, now }), null);
});

test("changing the signature is rejected", async () => {
  const token = await createAdminSessionToken(email, { secret, now });
  const flipped = token.endsWith("A") ? `${token.slice(0, -1)}B` : `${token.slice(0, -1)}A`;
  assert.equal(await verifyAdminSessionToken(flipped, { secret, now }), null);
});

test("a token signed with another secret is rejected", async () => {
  const token = await createAdminSessionToken(email, { secret: "another-secret-that-is-also-long-enough", now });
  assert.equal(await verifyAdminSessionToken(token, { secret, now }), null);
});

test("a token is valid until just before expiry and rejected at expiry", async () => {
  const token = await createAdminSessionToken(email, { secret, now });
  const lifetimeMs = ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
  assert.notEqual(await verifyAdminSessionToken(token, { secret, now: now + lifetimeMs - 1000 }), null);
  assert.equal(await verifyAdminSessionToken(token, { secret, now: now + lifetimeMs }), null);
});

test("correctly signed tokens with a bad payload are rejected", async () => {
  const exp = now / 1000 + 60;
  const badPayloads = [
    Buffer.from("not json").toString("base64url"),
    encode({ exp }),
    encode({ sub: "", exp }),
    encode({ sub: email }),
    encode({ sub: email, exp: String(exp) })
  ];
  for (const payload of badPayloads) {
    assert.equal(await verifyAdminSessionToken(signWith(payload), { secret, now }), null);
  }
});

test("a missing or short secret fails closed", async () => {
  const token = await createAdminSessionToken(email, { secret, now });
  await assert.rejects(createAdminSessionToken(email, { secret: "too-short", now }));
  assert.equal(await verifyAdminSessionToken(token, { secret: "too-short", now }), null);

  const original = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  try {
    await assert.rejects(createAdminSessionToken(email, { now }));
    assert.equal(await verifyAdminSessionToken(token, { now }), null);
  } finally {
    if (original !== undefined) {
      process.env.ADMIN_SESSION_SECRET = original;
    }
  }
});

test("constantTimeEqual compares content and length", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "abcd"), false);
  assert.equal(constantTimeEqual("", ""), true);
});

test("cookie options are hardened and secure only in production", () => {
  const options = adminSessionCookieOptions("production");
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.secure, true);
  assert.equal(options.path, "/");
  assert.equal(options.maxAge, ADMIN_SESSION_MAX_AGE_SECONDS);
  assert.equal(adminSessionCookieOptions("development").secure, false);
});

async function requestAdmin(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie !== undefined) {
    headers.set("cookie", `${ADMIN_SESSION_COOKIE}=${cookie}`);
  }
  const original = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = secret;
  try {
    return await middleware(new NextRequest(`http://localhost:3000${path}`, { headers }));
  } finally {
    if (original === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = original;
    }
  }
}

test("middleware redirects protected pages without a cookie or with a forged one", async () => {
  for (const path of ["/admin", "/admin/cms", "/data-pulls"]) {
    for (const cookie of [undefined, "true", "forged.signature"]) {
      const response = await requestAdmin(path, cookie);
      assert.equal(response.status, 307);
      const location = new URL(response.headers.get("location") ?? "");
      assert.equal(location.pathname, "/admin-login");
      assert.equal(location.searchParams.get("from"), path);
    }
  }
});

test("middleware allows a protected page with a valid signed cookie", async () => {
  const token = await createAdminSessionToken(email, { secret });
  const response = await requestAdmin("/admin", token);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("middleware redirects when the signed cookie has expired", async () => {
  const token = await createAdminSessionToken(email, { secret, now: Date.now() - (ADMIN_SESSION_MAX_AGE_SECONDS + 1) * 1000 });
  const response = await requestAdmin("/admin", token);
  assert.equal(response.status, 307);
});
