import { test } from "node:test";
import assert from "node:assert/strict";
import { signTelemetry, verifyTelemetrySignature } from "../lib/robot-signature";

const secret = "robot-secret-for-tests-0123456789";
const body = JSON.stringify({ inventoryId: "u1", interactionCount: 12 });
const now = 1_790_000_000;

test("valid signature within the time window is accepted", () => {
  const ts = String(now - 10);
  assert.deepEqual(verifyTelemetrySignature(secret, ts, signTelemetry(secret, ts, body), body, now), { ok: true });
});

test("tampered body, wrong secret, replay and missing config are rejected", () => {
  const ts = String(now);
  const sig = signTelemetry(secret, ts, body);
  assert.equal(verifyTelemetrySignature(secret, ts, sig, body.replace("12", "99"), now).ok, false);
  assert.equal(verifyTelemetrySignature(secret, ts, signTelemetry("another-secret-0123456789", ts, body), body, now).ok, false);
  const old = String(now - 3600);
  const r = verifyTelemetrySignature(secret, old, signTelemetry(secret, old, body), body, now);
  assert.equal(r.ok, false);
  const off = verifyTelemetrySignature(undefined, ts, sig, body, now);
  assert.equal(off.ok === false && off.status, 503);
  assert.equal(verifyTelemetrySignature(secret, ts, "zz", body, now).ok, false);
});
