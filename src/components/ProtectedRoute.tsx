import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: React.ReactNode;
  requiredRole?: "admin" | "client" | "technician" | "engineer";
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [roleLoading, setRoleLoading] = useState(!!requiredRole);
  const [hasRole, setHasRole] = useState(false);

  useEffect(() => {
    if (!requiredRole) {
      setHasRole(true);
      setRoleLoading(false);
      return;
    }

    if (loading) {
      return;
    }

    if (!user) {
      setHasRole(false);
      setRoleLoading(false);
      return;
    }

    let cancelled = false;
    setRoleLoading(true);

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const roles = new Set(data?.map((r) => r.role) ?? []);
        setHasRole(roles.has(requiredRole) || roles.has("admin"));
        setRoleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading, requiredRole]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (requiredRole && !hasRole) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}
