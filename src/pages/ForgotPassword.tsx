import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft, MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Password reset email sent");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <BrandMark size="md" />
        </div>

        <div className="rounded-xl border shadow-elevated p-7 bg-card">
          {sent ? (
            <div className="text-center py-2">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-hvhz-green-light">
                <MailCheck className="h-6 w-6 text-hvhz-green" />
              </div>
              <h1 className="font-display text-xl font-bold text-primary">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                We sent a reset link to <span className="font-medium text-primary">{email}</span>.
                It may take a minute to arrive.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-xs text-hvhz-teal hover:underline"
              >
                Didn't get it? Send again
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="font-display text-xl font-bold text-primary">Reset password</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Enter your email and we'll send you a reset link.
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
                <Button
                  type="submit"
                  className="w-full h-11 bg-hvhz-teal text-white hover:bg-hvhz-teal/90 shadow-lg shadow-hvhz-teal/20"
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>

        <Link to="/auth" className="mt-6 flex items-center justify-center gap-1 text-sm text-hvhz-teal hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
