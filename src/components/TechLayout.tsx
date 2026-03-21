import { SidebarProvider } from "@/components/ui/sidebar";
import { TechSidebar } from "@/components/TechSidebar";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TechLayoutProps {
  children: React.ReactNode;
}

export function TechLayout({ children }: TechLayoutProps) {
  const { user, loading } = useAuth();
  const [isTech, setIsTech] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const roles = new Set(data?.map((r) => r.role) ?? []);
        setIsTech(roles.has("technician") || roles.has("admin"));
      });
  }, [user]);

  if (loading || isTech === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isTech) return <Navigate to="/portal/dashboard" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <TechSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
