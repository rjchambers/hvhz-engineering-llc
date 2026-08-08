import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getDefaultRouteForRoles, getUserRoles } from "@/lib/authz";
import { AUTH_RETURN_TO_KEY } from "@/components/order/AuthGateDialog";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;
      const user = session.user;

      // Defer Supabase calls out of the auth callback (client library guidance)
      setTimeout(async () => {
        // Seed the profile from signup metadata so the account starts with a
        // name and company instead of an empty shell.
        const meta = user.user_metadata ?? {};
        if (meta.company_name || meta.full_name) {
          const { data: profile } = await supabase
            .from("client_profiles")
            .select("company_name, contact_name")
            .eq("user_id", user.id)
            .maybeSingle();
          const updates: Record<string, string> = {};
          if (!profile?.company_name && meta.company_name) updates.company_name = meta.company_name;
          if (!profile?.contact_name && meta.full_name) updates.contact_name = meta.full_name;
          if (Object.keys(updates).length > 0) {
            await supabase.from("client_profiles").update(updates).eq("user_id", user.id);
          }
        }

        // Return the user to where they were (e.g. the order form mid-submit),
        // falling back to their role's home.
        const returnTo = localStorage.getItem(AUTH_RETURN_TO_KEY);
        if (returnTo) {
          localStorage.removeItem(AUTH_RETURN_TO_KEY);
          navigate(returnTo, { replace: true });
          return;
        }
        try {
          const roles = await getUserRoles(user.id);
          navigate(getDefaultRouteForRoles(roles), { replace: true });
        } catch {
          navigate("/portal/dashboard", { replace: true });
        }
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Confirming your account…</p>
    </div>
  );
}
