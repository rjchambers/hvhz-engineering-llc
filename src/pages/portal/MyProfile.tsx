import { useState, useEffect } from "react";
import { PortalLayout } from "@/components/PortalLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAutosave } from "@/hooks/useAutosave";
import { AutosaveIndicator } from "@/components/AutosaveIndicator";

export default function MyProfile() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    contact_phone: "",
    company_address: "",
    company_city: "",
    company_state: "FL",
    company_zip: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("client_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            company_name: data.company_name ?? "",
            contact_name: data.contact_name ?? "",
            contact_phone: data.contact_phone ?? "",
            company_address: data.company_address ?? "",
            company_city: data.company_city ?? "",
            company_state: data.company_state ?? "FL",
            company_zip: data.company_zip ?? "",
          });
        }
        setLoading(false);
      });
  }, [user]);

  const { status: profileAutosave, clearDraft: clearProfileDraft } = useAutosave({
    storageKey: `client-profile-${user?.id}`,
    data: form,
    onRestore: (restored) => {
      setForm(prev => ({ ...prev, ...restored }));
      toast.info("Restored your unsaved changes", { duration: 3000 });
    },
    disabled: loading || !user,
  });

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_profiles").upsert({
        user_id: user.id,
        contact_email: user.email,
        ...form,
      }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <PortalLayout>
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-primary">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your company information and account settings.</p>

        {loading ? (
          <div className="mt-8 space-y-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} readOnly className="bg-muted cursor-not-allowed" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input id="company_name" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input id="contact_name" value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Phone</Label>
                <Input id="contact_phone" type="tel" value={form.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="company_address">Company Address</Label>
                <Input id="company_address" value={form.company_address} onChange={(e) => update("company_address", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_city">City</Label>
                <Input id="company_city" value={form.company_city} onChange={(e) => update("company_city", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_state">State</Label>
                  <Input id="company_state" value={form.company_state} onChange={(e) => update("company_state", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_zip">ZIP</Label>
                  <Input id="company_zip" value={form.company_zip} onChange={(e) => update("company_zip", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Link
                to="/forgot-password"
                className="flex items-center gap-1.5 text-sm text-hvhz-teal hover:underline"
              >
                <KeyRound className="h-4 w-4" />
                Change Password
              </Link>
              <Button onClick={handleSave} disabled={saving} className="gap-2 bg-primary text-primary-foreground">
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
