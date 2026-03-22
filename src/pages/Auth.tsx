import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDefaultRouteForRoles, getUserRoles } from "@/lib/authz";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const SERVICE_TAGLINES = [
  "TAS-105 Testing",
  "Drainage Analysis",
  "Wind Mitigation",
  "Fastener Calculations",
  "Roof Certifications",
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [taglineIdx, setTaglineIdx] = useState(0);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIdx((prev) => (prev + 1) % SERVICE_TAGLINES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

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
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-hvhz-teal/5 rounded-full blur-[100px]" />

        <div className="relative text-center max-w-sm z-10">
          <div className="flex justify-center mb-8">
            <BrandMark size="lg" variant="light" />
          </div>

          <p className="text-lg font-medium text-hvhz-teal mt-4">
            Serving Palm Beach, Broward &amp; Miami-Dade
          </p>

          {/* Rotating tagline */}
          <div className="mt-6 h-8 overflow-hidden relative">
            {SERVICE_TAGLINES.map((tagline, i) => (
              <p
                key={tagline}
                className="absolute inset-0 flex items-center justify-center text-sm text-white/40 font-mono transition-all duration-500"
                style={{
                  opacity: i === taglineIdx ? 1 : 0,
                  transform: i === taglineIdx ? "translateY(0)" : "translateY(8px)",
                }}
              >
                {tagline}
              </p>
            ))}
          </div>

          <p className="mt-12 text-[11px] text-white/15 font-mono tracking-wider">
            FBC 8th Edition · ASCE 7-22 · TAS 105
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 text-center md:hidden">
            <div className="flex justify-center mb-4">
              <BrandMark size="lg" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLogin ? "Sign in to your account" : "Create a new account"}
            </p>
          </div>

          {/* Desktop heading */}
          <div className="hidden md:block mb-8">
            <h2 className="text-xl font-bold text-primary">
              {isLogin ? "Sign in to your account" : "Create a new account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLogin ? "Enter your credentials to continue" : "Fill in the details below to get started"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
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
              className="w-full bg-hvhz-teal text-white hover:bg-hvhz-teal/90 shadow-lg shadow-hvhz-teal/20 active:scale-[0.98] transition-all"
              disabled={loading}
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-hvhz-teal hover:underline"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
