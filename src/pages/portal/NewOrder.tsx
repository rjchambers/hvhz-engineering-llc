import { useState, useEffect } from "react";
import { PortalLayout } from "@/components/PortalLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepCompany } from "@/components/wizard/StepCompany";
import { StepJobSite } from "@/components/wizard/StepJobSite";
import { StepRoofData } from "@/components/wizard/StepRoofData";
import { StepReview } from "@/components/wizard/StepReview";
import { loadWizardData, saveWizardData, clearWizardData, type WizardData } from "@/lib/wizard-data";
import { getServicePrice } from "@/lib/services";

const STEP_LABELS = ["Company & Contact", "Job Site & Services", "Roof Data", "Review & Pay"];

export default function NewOrder() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(loadWizardData);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from client_profiles + auth email
  useEffect(() => {
    if (!user) return;
    const prefill = async () => {
      setData((prev) => ({ ...prev, contact_email: user.email ?? "" }));

      const { data: profile } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setData((prev) => ({
          ...prev,
          company_name: profile.company_name ?? prev.company_name,
          contact_name: profile.contact_name ?? prev.contact_name,
          contact_email: profile.contact_email ?? user.email ?? "",
          contact_phone: profile.contact_phone ?? prev.contact_phone,
          company_address: profile.company_address ?? prev.company_address,
          company_city: profile.company_city ?? prev.company_city,
          company_state: profile.company_state ?? prev.company_state,
          company_zip: profile.company_zip ?? prev.company_zip,
        }));
      }
    };
    prefill();
  }, [user]);

  // Save to localStorage on change
  useEffect(() => {
    saveWizardData(data);
  }, [data]);

  const onChange = (patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const handleStep1Next = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_profiles").upsert({
        user_id: user.id,
        company_name: data.company_name,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
        company_address: data.company_address,
        company_city: data.company_city,
        company_state: data.company_state,
        company_zip: data.company_zip,
      }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Profile saved");
      setStep(1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Update terms_accepted_at
      await supabase.from("client_profiles").update({
        terms_accepted_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      const total = data.selected_services.reduce((s, k) => s + getServicePrice(k), 0);

      // For now, since Stripe checkout edge function is built in Prompt 11,
      // we create the order directly with pending_payment status
      const { data: order, error } = await supabase.from("orders").insert({
        client_id: user.id,
        services: data.selected_services,
        job_address: data.job_address,
        job_city: data.job_city,
        job_zip: data.job_zip,
        job_county: data.job_county,
        roof_data: {
          gated_community: data.gated_community,
          gate_code: data.gate_code,
          roof_report_path: data.roof_report_path,
        },
        total_amount: total,
        status: "pending_payment",
        notes: data.gated_community ? `Gated community. Gate code: ${data.gate_code}` : null,
      }).select().single();

      if (error) throw error;

      clearWizardData();

      // Redirect to confirmed page (in production, this would go through Stripe first)
      window.location.href = `/portal/order-confirmed?order_id=${order.id}`;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalLayout>
      <div className="px-6 py-8 max-w-3xl mx-auto">
        {/* Step indicator */}
        <nav className="mb-8">
          <ol className="flex items-center gap-2">
            {STEP_LABELS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  i === step ? "bg-hvhz-teal text-white" :
                  i < step ? "bg-hvhz-teal/20 text-hvhz-teal" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`hidden sm:inline text-xs font-medium ${
                  i === step ? "text-primary" : "text-muted-foreground"
                }`}>
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`h-px w-6 sm:w-10 ${i < step ? "bg-hvhz-teal/40" : "bg-border"}`} />
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Step content */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {step === 0 && (
            <StepCompany data={data} onChange={onChange} onNext={handleStep1Next} saving={saving} />
          )}
          {step === 1 && (
            <StepJobSite data={data} onChange={onChange} onNext={() => setStep(2)} onBack={() => setStep(0)} />
          )}
          {step === 2 && user && (
            <StepRoofData data={data} onChange={onChange} onNext={() => setStep(3)} onBack={() => setStep(1)} userId={user.id} />
          )}
          {step === 3 && (
            <StepReview data={data} onChange={onChange} onSubmit={handleSubmit} onBack={() => setStep(2)} submitting={submitting} />
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
