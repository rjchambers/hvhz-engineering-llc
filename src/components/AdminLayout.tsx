import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (loading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/portal/dashboard" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
