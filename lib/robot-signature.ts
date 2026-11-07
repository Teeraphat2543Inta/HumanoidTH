import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Robots sign every telemetry POST so nobody can inject fake interaction logs.
 *   x-robot-timestamp: unix seconds
 *   x-robot-signature: hex HMAC-SHA256 of `${timestamp}.${rawBody}` with ROBOT_WEBHOOK_SECRET
 * Requests older than 5 minutes are rejected (replay protection).
 */
export const MAX_SKEW_SECONDS = 300;

export function signTelemetry(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export type SignatureCheck = { ok: true } | { ok: false; status: number; error: string };

export function verifyTelemetrySignature(
  secret: string | undefined,
  timestamp: string | null,
  signature: string | null,
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): SignatureCheck {
  if (!secret || secret.length < 16) return { ok: false, status: 503, error: "Robot telemetry is disabled: ROBOT_WEBHOOK_SECRET is not configured." };
  if (!timestamp || !signature) return { ok: false, status: 401, error: "Missing x-robot-timestamp or x-robot-signature." };
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) {
    return { ok: false, status: 401, error: "Timestamp outside the allowed 5-minute window." };
  }
  const expected = Buffer.from(signTelemetry(secret, timestamp, rawBody), "hex");
  const given = Buffer.from(signature, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, status: 401, error: "Invalid signature." };
  }
  return { ok: true };
}
