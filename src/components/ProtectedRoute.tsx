import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  canAccessRole,
  getDefaultRouteForRoles,
  getUserRoles,
  type AppRole,
} from "@/lib/authz";

interface Props {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [roleLoading, setRoleLoading] = useState(!!requiredRole);
  const [hasRole, setHasRole] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/auth");

  useEffect(() => {
    if (!requiredRole) {
      setHasRole(true);
      setRedirectTo("/auth");
      setRoleLoading(false);
      return;
    }

    if (loading) {
      return;
    }

    if (!user) {
      setHasRole(false);
      setRedirectTo("/auth");
      setRoleLoading(false);
      return;
    }

    let cancelled = false;
    setRoleLoading(true);

    getUserRoles(user.id)
      .then((roles) => {
        if (cancelled) return;
        setHasRole(canAccessRole(roles, requiredRole));
        setRedirectTo(getDefaultRouteForRoles(roles));
        setRoleLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasRole(false);
        setRedirectTo("/auth");
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
  if (requiredRole && !hasRole) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
}
