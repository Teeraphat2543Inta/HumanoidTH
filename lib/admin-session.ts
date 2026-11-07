// Signed admin session cookie. Uses only Web APIs so it runs in both the Edge
// middleware and Node server code. Token format: <base64url payload>.<base64url HMAC>

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const MIN_SECRET_LENGTH = 32;

// Example values published in .env.example and the docs. Anyone can read them,
// so using one is treated the same as not configuring admin access at all.
const PLACEHOLDER_PASSWORDS = new Set(["change-this-before-deploy", "use-a-strong-password", "<strong unique password>"]);

export type AdminSession = {
  sub: string;
  exp: number;
};

type TokenOptions = {
  secret?: string;
  now?: number;
};

function usableSecret(secret: string | undefined = process.env.ADMIN_SESSION_SECRET) {
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(payload: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

export function constantTimeEqual(a: string, b: string) {
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function createAdminSessionToken(email: string, options: TokenOptions = {}) {
  const secret = usableSecret(options.secret);
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is missing or too short.");
  }

  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const session: AdminSession = { sub: email, exp: nowSeconds + ADMIN_SESSION_MAX_AGE_SECONDS };
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifyAdminSessionToken(token: string | undefined, options: TokenOptions = {}): Promise<AdminSession | null> {
  const secret = usableSecret(options.secret);
  if (!secret || !token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  const [payload, signature] = parts;

  if (!constantTimeEqual(signature, await sign(payload, secret))) {
    return null;
  }

  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as Partial<AdminSession>;
    if (typeof session.sub !== "string" || !session.sub || typeof session.exp !== "number") {
      return null;
    }
    const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
    return session.exp > nowSeconds ? { sub: session.sub, exp: session.exp } : null;
  } catch {
    return null;
  }
}

function adminCredentials() {
  const user = process.env.ADMIN_BASIC_USER?.trim();
  const password = process.env.ADMIN_BASIC_PASSWORD?.trim();
  if (!user || !password || PLACEHOLDER_PASSWORDS.has(password) || !usableSecret()) {
    return null;
  }
  return { user, password };
}

export function isAdminConfigured() {
  return adminCredentials() !== null;
}

export function verifyAdminCredentials(email: string, password: string) {
  const expected = adminCredentials();
  if (!expected) {
    return false;
  }
  const userMatches = constantTimeEqual(email, expected.user);
  const passwordMatches = constantTimeEqual(password, expected.password);
  return userMatches && passwordMatches;
}

export function verifyAdminBasicAuth(header: string | null) {
  if (!header?.startsWith("Basic ")) {
    return false;
  }
  try {
    const decoded = atob(header.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) {
      return false;
    }
    return verifyAdminCredentials(decoded.slice(0, separator), decoded.slice(separator + 1));
  } catch {
    return false;
  }
}

export function adminSessionCookieOptions(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
  };
}
