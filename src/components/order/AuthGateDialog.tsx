import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, MailCheck, ShieldCheck } from "lucide-react";

export const AUTH_RETURN_TO_KEY = "hvhz-auth-return-to";

interface AuthGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled from the order form so the user types as little as possible. */
  defaultEmail: string;
  companyName?: string;
  contactName?: string;
  /** Called with the authenticated user id once a session exists. */
  onAuthed: (userId: string) => void;
}

/**
 * Inline sign-in / sign-up shown when a signed-out visitor submits the public
 * order form. Their order draft is already saved to localStorage before this
 * opens, so nothing is lost in either path:
 *  - Sign in  -> session immediately -> onAuthed continues the submit.
 *  - Sign up  -> confirmation email -> /auth/callback returns them to /order
 *    where the draft restores and they submit as an authenticated user.
 */
export function AuthGateDialog({
  open, onOpenChange, defaultEmail, companyName, contactName, onAuthed,
}: AuthGateDialogProps) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setPassword("");
      setConfirmationSent(false);
    }
  }, [open, defaultEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.user) throw new Error("Sign-in failed — please try again");
        toast.success("Signed in — completing your order…");
        onAuthed(data.user.id);
      } else {
        // Come back to the order form after the email confirmation round-trip.
        localStorage.setItem(AUTH_RETURN_TO_KEY, "/order");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              company_name: companyName || "",
              full_name: contactName || "",
            },
          },
        });
        if (error) throw error;
        if (data.session && data.user) {
          // Email confirmation disabled on the project — we're in immediately.
          onAuthed(data.user.id);
        } else {
          setConfirmationSent(true);
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {confirmationSent ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-hvhz-green-light">
              <MailCheck className="h-6 w-6 text-hvhz-green" />
            </div>
            <DialogTitle className="font-display text-xl">Confirm your email to finish</DialogTitle>
            <DialogDescription className="mt-2 leading-relaxed">
              We sent a confirmation link to <span className="font-medium text-primary">{email}</span>.
              <br />
              <span className="mt-2 inline-flex items-center gap-1.5 text-hvhz-green font-medium">
                <ShieldCheck className="h-4 w-4" /> Your order is saved
              </span>
              <br />
              Click the link and you'll land right back here with everything filled in — just hit submit.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {mode === "signup" ? "One last step — create your login" : "Sign in to submit"}
              </DialogTitle>
              <DialogDescription>
                {mode === "signup"
                  ? "Your order is saved. A free account lets you track this job, download the sealed report, and reorder in clicks."
                  : "Your order is saved — sign in and we'll submit it right away."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="gate-email">Work email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="gate-email"
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
                <Label htmlFor="gate-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="gate-password"
                    type="password"
                    placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-hvhz-teal text-white hover:bg-hvhz-teal/90 shadow-lg shadow-hvhz-teal/20"
                disabled={loading}
              >
                {loading
                  ? "Please wait…"
                  : mode === "signup" ? "Create account & continue" : "Sign in & submit order"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New to HVHZ Engineering?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="font-medium text-hvhz-teal hover:underline"
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
