import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, adminLoginRedirectFor } from "@/lib/admin-session";

// Server actions can be called directly, without passing through the pages the
// middleware protects, so every admin action must call this as its first step.
// redirect() works by throwing, so never call this inside a try block.
export async function requireAdmin() {
  const cookieStore = await cookies();
  const loginRedirect = await adminLoginRedirectFor(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (loginRedirect) {
    redirect(loginRedirect);
  }
}
