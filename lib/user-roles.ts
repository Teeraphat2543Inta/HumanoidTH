// Rules for what a signed-out visitor may choose. ADMIN is deliberately absent:
// only adminLoginAction, after checking the password, can grant admin access.

export const SELF_SERVICE_ROLES = ["USER", "RESEARCHER"] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export function selfServiceRole(value: unknown): SelfServiceRole {
  return SELF_SERVICE_ROLES.find((role) => role === value) ?? "USER";
}

// The role is set only when the account is created, so nobody can change the
// role of an existing account by registering again with its email.
export function selfServiceUserUpsert({ email, name, role }: { email: string; name: string; role: unknown }) {
  return {
    where: { email },
    update: { name: name || undefined },
    create: {
      email,
      name: name || email.split("@")[0],
      role: selfServiceRole(role)
    }
  };
}

// An email alone proves nothing, so an account that is ADMIN in the database
// still gets a plain role cookie unless it came through the admin login.
export function unverifiedRoleCookieValue(role: string) {
  return role === "ADMIN" ? "USER" : role;
}

export function isRoleSimulationEnabled(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return nodeEnv === "development";
}
