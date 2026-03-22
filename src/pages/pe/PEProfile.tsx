import { useState, useEffect, useCallback } from "react";
import { PELayout } from "@/components/PELayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAutosave } from "@/hooks/useAutosave";
import { AutosaveIndicator } from "@/components/AutosaveIndicator";
import {
  Loader2, Upload, ShieldCheck, AlertTriangle, Check, Lock, KeyRound,
} from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";

export default function PEProfile() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("FL");
  const [peExpiry, setPeExpiry] = useState("");
  const [firmName, setFirmName] = useState("");

  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const [digitalSigningEnabled, setDigitalSigningEnabled] = useState(false);
  const [p12Path, setP12Path] = useState<string | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);

  const [resettingPassword, setResettingPassword] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("engineer_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setProfileId(data.id);
      setFullName(data.full_name);
      setLicenseNumber(data.pe_license_number ?? "");
      setLicenseState(data.pe_license_state ?? "FL");
      setPeExpiry(data.pe_expiry ?? "");
      setFirmName(data.firm_name ?? "");
      setStampUrl(data.stamp_image_url);
      setSignatureUrl(data.signature_image_url);
      setDigitalSigningEnabled(data.digital_signing_enabled ?? false);
      setP12Path(data.p12_certificate_path);
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const profileFormData = { fullName, licenseNumber, licenseState, peExpiry, firmName };

  const { status: profileAutosave, clearDraft: clearProfileDraft } = useAutosave({
    storageKey: `pe-profile-${user?.id}`,
    data: profileFormData,
    onRestore: (restored) => {
      if (restored.fullName) setFullName(restored.fullName);
      if (restored.licenseNumber) setLicenseNumber(restored.licenseNumber);
      if (restored.licenseState) setLicenseState(restored.licenseState);
      if (restored.peExpiry) setPeExpiry(restored.peExpiry);
      if (restored.firmName) setFirmName(restored.firmName);
      toast.info("Restored your unsaved changes", { duration: 3000 });
    },
    disabled: !loaded || !user,
  });

  const expiryDaysLeft = peExpiry
    ? differenceInDays(parseISO(peExpiry), new Date())
    : null;
  const expiryWarning = expiryDaysLeft !== null && expiryDaysLeft <= 90 && expiryDaysLeft > 0;
  const expiryExpired = expiryDaysLeft !== null && expiryDaysLeft <= 0;

  const handleSaveProfile = async () => {
    if (!user || !fullName.trim()) { toast.error("Full name is required"); return; }
    setSaving(true);
    const payload = {
      user_id: user.id,
      full_name: fullName.trim(),
      pe_license_number: licenseNumber.trim() || null,
      pe_license_state: licenseState.trim() || "FL",
      pe_expiry: peExpiry || null,
      firm_name: firmName.trim() || null,
    };

    const { error } = profileId
      ? await supabase.from("engineer_profiles").update(payload).eq("id", profileId)
      : await supabase.from("engineer_profiles").insert(payload).select("id").single().then(res => {
          if (res.data) setProfileId(res.data.id);
          return res;
        });

    if (error) toast.error("Save failed: " + error.message);
    else toast.success("Profile saved");
    setSaving(false);
  };

  const uploadFile = async (
    file: File,
    path: string,
    onUrl: (url: string) => void,
    dbField: string,
    setUploading: (v: boolean) => void,
  ) => {
    if (!user) return;
    setUploading(true);

    const { error: upErr } = await supabase.storage
      .from("pe-credentials")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      toast.error("Upload failed: " + upErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = await supabase.storage
      .from("pe-credentials")
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    const url = urlData?.signedUrl ?? path;
    onUrl(url);

    // Save to profile
    if (profileId) {
      await supabase.from("engineer_profiles").update({ [dbField]: url }).eq("id", profileId);
    }

    toast.success("File uploaded");
    setUploading(false);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    uploadFile(file, `pe-stamps/${user.id}/stamp.png`, setStampUrl, "stamp_image_url", setUploadingStamp);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    uploadFile(file, `${user.id}/signature.png`, setSignatureUrl, "signature_image_url", setUploadingSignature);
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingCert(true);
    const path = `${user.id}/certificate.p12`;

    const { error: upErr } = await supabase.storage
      .from("pe-credentials")
      .upload(path, file, { upsert: true, contentType: "application/x-pkcs12" });

    if (upErr) {
      toast.error("Upload failed: " + upErr.message);
      setUploadingCert(false);
      return;
    }

    setP12Path(path);
    if (profileId) {
      await supabase.from("engineer_profiles").update({ p12_certificate_path: path }).eq("id", profileId);
    }
    toast.success("Certificate uploaded");
    setUploadingCert(false);
  };

  const handleToggleDigitalSigning = async (checked: boolean) => {
    setDigitalSigningEnabled(checked);
    if (profileId) {
      await supabase.from("engineer_profiles").update({ digital_signing_enabled: checked }).eq("id", profileId);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResettingPassword(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email.");
    setResettingPassword(false);
  };

  if (!loaded) return <PELayout><div className="p-6 text-sm text-muted-foreground">Loading…</div></PELayout>;

  return (
    <PELayout>
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-primary">My Profile & Credentials</h1>
        <p className="text-sm text-muted-foreground -mt-4">Manage your PE license, stamp, and signing credentials.</p>

        {/* Profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              Profile Information
              {expiryWarning && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />License expires in {expiryDaysLeft} days</Badge>}
              {expiryExpired && <Badge variant="destructive" className="text-[10px]">License expired</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Full Name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Firm Name</Label>
                <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">PE License Number</Label>
                <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">License State</Label>
                <Input value={licenseState} onChange={(e) => setLicenseState(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">License Expiry</Label>
                <Input type="date" value={peExpiry} onChange={(e) => setPeExpiry(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={user?.email ?? ""} disabled className="h-9 text-sm bg-muted" />
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} size="sm">
              {saving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving…</> : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* PE Stamp */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">PE Stamp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Upload your PE stamp image (PNG with transparent background recommended).</p>
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/40 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">
                    {uploadingStamp ? "Uploading…" : "Click to upload stamp"}
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleStampUpload} disabled={uploadingStamp} />
                </label>
              </div>
              {stampUrl && (
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Current Stamp</p>
                  <img src={stampUrl} alt="PE Stamp" className="w-[100px] h-[100px] object-contain border rounded bg-white" />
                </div>
              )}
            </div>
            {stampUrl && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-muted-foreground mb-2">Stamp Preview (as it appears on reports)</p>
                <div className="relative w-[180px] h-[100px] border rounded bg-white p-2">
                  <div className="absolute bottom-1 left-1 w-16 h-16">
                    <img src={stampUrl} alt="Stamp preview" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[7px] text-muted-foreground">...report content</p>
                  <div className="absolute top-1 right-1 text-[6px] text-muted-foreground text-right">
                    <p>HVHZ ENGINEERING</p>
                    <p>Signed Report</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signature */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Signature Image <span className="text-muted-foreground font-normal">(optional)</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Upload your signature image for future use on reports.</p>
            <div className="flex items-start gap-6">
              <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/40 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">
                  {uploadingSignature ? "Uploading…" : "Click to upload signature"}
                </span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSignatureUpload} disabled={uploadingSignature} />
              </label>
              {signatureUrl && (
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Current Signature</p>
                  <img src={signatureUrl} alt="Signature" className="w-[120px] h-[50px] object-contain border rounded bg-white" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Digital Signing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Advanced — PKCS#7 Digital Certificate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable cryptographic digital signing</p>
                <p className="text-xs text-muted-foreground">Uses your .p12/.pfx certificate for FAC-compliant signing</p>
              </div>
              <Switch checked={digitalSigningEnabled} onCheckedChange={handleToggleDigitalSigning} />
            </div>

            {digitalSigningEnabled && (
              <div className="space-y-3 pt-2">
                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/40 transition-colors">
                  <Lock className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">
                    {uploadingCert ? "Uploading…" : "Upload .p12 or .pfx certificate"}
                  </span>
                  <input type="file" accept=".p12,.pfx" className="hidden" onChange={handleCertUpload} disabled={uploadingCert} />
                </label>

                {p12Path && (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Certificate configured
                    </Badge>
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Lock className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-[11px] text-muted-foreground">
                      Your certificate password is <strong>NEVER</strong> stored. You will enter it at the time of each signing. FAC 61G15-23.004 compliant.
                    </p>
                  </div>
                  <Separator />
                  <p className="text-[10px] text-muted-foreground">
                    Florida compliance: F.S. §471.025, F.S. §668.003(3), FAC 61G15-23.004
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">We'll send a password reset link to {user?.email}.</p>
            <Button variant="outline" size="sm" onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Sending…</> : "Send Reset Link"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PELayout>
  );
}
