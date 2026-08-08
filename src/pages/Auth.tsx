import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDefaultRouteForRoles, getUserRoles } from "@/lib/authz";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const VALUE_POINTS = [
  "Order any service in minutes",
  "Track every job in real time",
  "Download PE-sealed reports",
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    let cancelled = false;
    if (authLoading || !user) return;
    getUserRoles(user.id)
      .then((roles) => {
        if (cancelled) return;
        navigate(getDefaultRouteForRoles(roles), { replace: true });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        toast.error(error.message);
      });
    return () => { cancelled = true; };
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in successfully");
        if (signInData.user) {
          const roles = await getUserRoles(signInData.user.id);
          navigate(getDefaultRouteForRoles(roles), { replace: true });
        } else {
          navigate("/portal/dashboard", { replace: true });
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — desktop only */}
      <div className="hidden md:flex md:w-1/2 hero-gradient relative items-center justify-center px-12 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />

        <div className="relative max-w-sm z-10">
          <BrandMark size="lg" variant="light" />

          <h2 className="mt-10 font-display text-2xl font-bold text-white leading-snug">
            Roof engineering for hurricane country.
          </h2>
          <p className="mt-3 text-sm text-white/50 leading-relaxed">
            Serving Miami-Dade, Broward &amp; Palm Beach counties.
          </p>

          <ul className="mt-8 space-y-3.5">
            {VALUE_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3 text-sm text-white/75">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-hvhz-teal" />
                {point}
              </li>
            ))}
          </ul>

          <p className="mt-14 text-[11px] text-white/30 font-mono tracking-wider">
            FBC 8TH EDITION · ASCE 7-22 · TAS 105
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>

          {/* Mobile brand */}
          <div className="mb-8 md:hidden">
            <BrandMark size="md" />
          </div>

          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-primary tracking-tight">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isLogin
                ? "Sign in to your portal to manage orders and reports."
                : "Set up your login — you can place your first order right after."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={isLogin ? "••••••••" : "At least 6 characters"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {isLogin && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-hvhz-teal hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-hvhz-teal text-white hover:bg-hvhz-teal/90 shadow-lg shadow-hvhz-teal/20 active:scale-[0.98] transition-all"
              disabled={loading}
            >
              {loading ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "New to HVHZ Engineering?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-hvhz-teal hover:underline"
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
