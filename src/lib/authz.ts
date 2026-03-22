import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "client" | "technician" | "engineer";

const KNOWN_ROLES: AppRole[] = ["admin", "client", "technician", "engineer"];
const roleCache = new Map<string, Promise<Set<AppRole>>>();

function normalizeRoles(rawRoles: Array<{ role: string }> | null | undefined) {
  const roles = new Set<AppRole>();

  for (const entry of rawRoles ?? []) {
    if (KNOWN_ROLES.includes(entry.role as AppRole)) {
      roles.add(entry.role as AppRole);
    }
  }

  if (roles.size === 0) {
    roles.add("client");
  }

  return roles;
}

export async function getUserRoles(userId: string) {
  let request = roleCache.get(userId);

  if (!request) {
    request = (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      return normalizeRoles(data);
    })();

    roleCache.set(userId, request);
  }

  return request;
}

export function clearUserRolesCache(userId?: string) {
  if (userId) {
    roleCache.delete(userId);
    return;
  }

  roleCache.clear();
}

export function canAccessRole(roles: Set<AppRole>, requiredRole: AppRole) {
  return roles.has("admin") || roles.has(requiredRole);
}

export function getDefaultRouteForRoles(roles: Set<AppRole>) {
  if (roles.has("admin")) return "/admin";
  if (roles.has("engineer")) return "/pe";
  if (roles.has("technician")) return "/tech";
  return "/portal/dashboard";
}