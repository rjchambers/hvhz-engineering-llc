import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import {
  ShoppingCart, User, MapPin, Settings2, Upload, DollarSign, FileCheck, LogIn,
  CheckCircle2, ArrowRight,
} from "lucide-react";
import { AuthGateDialog } from "@/components/order/AuthGateDialog";
import { HeroNav } from "@/components/HeroNav";
import { OrderHero } from "@/components/order/OrderHero";
import { FormSection } from "@/components/order/FormSection";
import { ServiceSelection } from "@/components/order/ServiceSelection";
import { ClientInfoForm, ClientInfo } from "@/components/order/ClientInfoForm";
import { JobInfoForm, JobInfo } from "@/components/order/JobInfoForm";
import { ServiceSpecificFields, ServiceSpecificData } from "@/components/order/ServiceSpecificFields";
import { FileUploadSection } from "@/components/order/FileUploadSection";
import { PricingSection } from "@/components/order/PricingSection";
import { TermsAndPayment } from "@/components/order/TermsAndPayment";
import {
  VARIABLE_RATE_SERVICES, calculateServicePrice, getDiscountPercentage,
  MOBILIZATION_FEE, SAME_DAY_FEE, REPORT_FEE, ORDER_SERVICES,
} from "@/components/order/orderServices";
import { Button } from "@/components/ui/button";

const initialClientInfo: ClientInfo = {
  companyName: "", companyAddress: "", city: "", state: "FL", zipCode: "",
  phone: "", fax: "", email: "", contactName: "", contactTitle: "",
  jobsiteContactName: "", jobsiteContactPhone: "", poNumber: "",
  gatedCommunity: "no", gateCode: "", emailProposalTo: "",
};

const initialJobInfo: JobInfo = {
  projectName: "", jobAddress: "", jobCity: "", jobState: "FL", jobZipCode: "",
  permitNumber: "", buildingArea: "Main Roof", roofLevels: "", stories: "",
  roofArea: "", parapetHeight: "", roofHeight: "", roofLength: "", roofWidth: "",
  roofSlope: "", newOrExisting: "new", newLWIC: "no", insideAccessName: "",
  insideAccessPhone: "", deckType: "", deckTypeOther: "", componentSecured: "",
  fastenerManufacturer: "", jobCounty: "", jobLat: null, jobLng: null,
};

/** localStorage key for the public order draft (cleaned by draft-cleanup TTL). */
const DRAFT_KEY = "hvhz-public-order-draft";

const initialServiceData: ServiceSpecificData = {
  fastenerManufacturer: "", insertingFastenersInto: "", fastenersNewExisting: "",
  tileType: "", tileShape: "", attachmentMethod: "", roofCompleted: "",
  permitNumber: "", brokenTiles: "", brokenTilesNotes: "", failedTilesCaps: "",
  failedTilesCapsNotes: "", deckAttachment: "", specialGridRequirements: "no",
  gridDetails: "", builtUpRoofSystem: "", gravelBallast: "", drainageInfo: "",
  inspectionTypes: [], scheduleContactName: "", scheduleContactPhone: "",
};

export default function PublicOrder() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [specialInspectionTypes, setSpecialInspectionTypes] = useState<string[]>([]);
  const [clientInfo, setClientInfo] = useState<ClientInfo>(initialClientInfo);
  const [jobInfo, setJobInfo] = useState<JobInfo>(initialJobInfo);
  const [serviceData, setServiceData] = useState<ServiceSpecificData>(initialServiceData);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [roofReport, setRoofReport] = useState<File | null>(null);
  const [roofReportType, setRoofReportType] = useState("Roofr");
  const [roofReportPath, setRoofReportPath] = useState<string | null>(null);
  const [roofReportName, setRoofReportName] = useState<string | null>(null);
  const [orderReport, setOrderReport] = useState(false);
  const [sameDayDispatch, setSameDayDispatch] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [previouslyAccepted, setPreviouslyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [distanceFee, setDistanceFee] = useState(0);
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const draftLoaded = useRef(false);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    services: true,
  });

  // ── Draft persistence ────────────────────────────────────────────────
  // Restore once on mount so a refresh, failed submit, or the sign-up email
  // round-trip never loses the visitor's work.
  useEffect(() => {
    if (isSuccess) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.selectedServices?.length || d.clientInfo?.companyName || d.jobInfo?.jobAddress) {
          setSelectedServices(d.selectedServices ?? []);
          setSpecialInspectionTypes(d.specialInspectionTypes ?? []);
          setClientInfo({ ...initialClientInfo, ...d.clientInfo });
          setJobInfo({ ...initialJobInfo, ...d.jobInfo });
          setServiceData({ ...initialServiceData, ...d.serviceData });
          setRoofReportType(d.roofReportType ?? "Roofr");
          setRoofReportPath(d.roofReportPath ?? null);
          setRoofReportName(d.roofReportName ?? null);
          setOrderReport(d.orderReport ?? false);
          setSameDayDispatch(d.sameDayDispatch ?? false);
          toast.info("Welcome back — your order draft was restored.");
        }
      }
    } catch { /* corrupted draft — start fresh */ }
    draftLoaded.current = true;
  }, [isSuccess]);

  // Save (debounced) whenever the form changes.
  useEffect(() => {
    if (!draftLoaded.current || isSuccess) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          selectedServices, specialInspectionTypes, clientInfo, jobInfo,
          serviceData, roofReportType, roofReportPath, roofReportName,
          orderReport, sameDayDispatch, _savedAt: Date.now(),
        }));
      } catch { /* storage full/unavailable */ }
    }, 700);
    return () => clearTimeout(timer);
  }, [selectedServices, specialInspectionTypes, clientInfo, jobInfo, serviceData,
      roofReportType, roofReportPath, roofReportName, orderReport, sameDayDispatch, isSuccess]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
  };

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleInspectionType = (type: string) => {
    setSpecialInspectionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Pre-fill from profile if logged in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setClientInfo((prev) => ({
          ...prev,
          companyName: data.company_name || "",
          companyAddress: data.company_address || "",
          city: data.company_city || "",
          state: data.company_state || "FL",
          zipCode: data.company_zip || "",
          email: data.contact_email || user.email || "",
          contactName: data.contact_name || "",
          phone: data.contact_phone || "",
        }));
        if (data.terms_accepted_at) setPreviouslyAccepted(true);
      }
    })();
  }, [user]);

  // Distance fee calculation (debounced)
  useEffect(() => {
    const { jobAddress, jobCity, jobZipCode } = jobInfo;
    if (!jobAddress || !jobCity || !jobZipCode || jobZipCode.length < 5) {
      setDistanceFee(0);
      setDistanceMiles(0);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("calculate-distance", {
          body: { jobAddress, jobCity, jobZipCode },
        });
        if (!error && data?.success) {
          setDistanceFee(data.feeApplies ? data.fee : 0);
          setDistanceMiles(data.distanceMiles);
        }
      } catch {
        // Silently ignore distance calc failures
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [jobInfo.jobAddress, jobInfo.jobCity, jobInfo.jobZipCode]);

  const roofArea = parseFloat(jobInfo.roofArea) || 0;
  const roofHeight = parseFloat(jobInfo.roofHeight) || 0;
  const requireRoofDetails = selectedServices.some((s) =>
    VARIABLE_RATE_SERVICES.includes(s as any)
  );

  // Calculate total
  const subtotal = selectedServices.reduce((sum, id) => sum + calculateServicePrice(id, roofArea), 0);
  const discountPct = getDiscountPercentage(selectedServices.length);
  const discountAmount = subtotal * (discountPct / 100);
  const mobilization = roofHeight > 24 ? MOBILIZATION_FEE : 0;
  const sameDayAmount = sameDayDispatch ? SAME_DAY_FEE : 0;
  const reportFee = orderReport ? REPORT_FEE : 0;
  const total = subtotal - discountAmount + mobilization + sameDayAmount + distanceFee + reportFee;

  // Validation
  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (selectedServices.length === 0) errs.services = "Select at least one service";
    if (!clientInfo.companyName.trim()) errs.companyName = "Required";
    if (!clientInfo.companyAddress.trim()) errs.companyAddress = "Required";
    if (!clientInfo.city.trim()) errs.city = "Required";
    if (!/^\d{5}$/.test(clientInfo.zipCode)) errs.zipCode = "Valid 5-digit zip required";
    if (clientInfo.phone.replace(/\D/g, "").length < 10) errs.phone = "Valid phone required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email)) errs.email = "Valid email required";
    if (!clientInfo.contactName.trim()) errs.contactName = "Required";
    if (!clientInfo.jobsiteContactName.trim()) errs.jobsiteContactName = "Required";
    if (clientInfo.jobsiteContactPhone.replace(/\D/g, "").length < 10) errs.jobsiteContactPhone = "Valid phone required";
    if (clientInfo.gatedCommunity === "yes" && !clientInfo.gateCode.trim()) errs.gateCode = "Required";
    if (!jobInfo.jobAddress.trim()) errs.jobAddress = "Required";
    if (!jobInfo.jobCity.trim()) errs.jobCity = "Required";
    if (!/^\d{5}$/.test(jobInfo.jobZipCode)) errs.jobZipCode = "Valid 5-digit zip required";
    if (requireRoofDetails) {
      if (!jobInfo.roofLevels) errs.roofLevels = "Required for selected services";
      if (!jobInfo.stories) errs.stories = "Required for selected services";
      if (!jobInfo.roofArea) errs.roofArea = "Required for selected services";
      if (!jobInfo.roofHeight) errs.roofHeight = "Required for selected services";
      if (!jobInfo.deckType) errs.deckType = "Required for selected services";
      if (jobInfo.deckType === "Other" && !jobInfo.deckTypeOther.trim()) errs.deckTypeOther = "Required";
    }
    if (!previouslyAccepted && !termsAccepted) errs.terms = "You must accept the terms";
    return errs;
  }, [selectedServices, clientInfo, jobInfo, requireRoofDetails, previouslyAccepted, termsAccepted]);

  const handleSubmit = async (authedUserId?: string) => {
    const errs = validate();
    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      // Auto-open sections with errors
      const sectionMap: Record<string, string[]> = {
        services: ["services"],
        client: ["companyName", "companyAddress", "city", "zipCode", "phone", "email", "contactName", "jobsiteContactName", "jobsiteContactPhone", "gateCode"],
        job: ["jobAddress", "jobCity", "jobZipCode", "roofLevels", "stories", "roofArea", "roofHeight", "deckType", "deckTypeOther"],
        terms: ["terms"],
      };
      const toOpen: Record<string, boolean> = {};
      for (const [section, fields] of Object.entries(sectionMap)) {
        if (fields.some((f) => errs[f])) toOpen[section] = true;
      }
      setOpenSections((prev) => ({ ...prev, ...toOpen }));
      toast.error("Please fix the errors before submitting");
      return;
    }

    // Signed out? Save the draft and open the inline auth gate — the order
    // survives the sign-in or the sign-up email round-trip either way.
    const uid = authedUserId ?? user?.id;
    if (!uid) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          selectedServices, specialInspectionTypes, clientInfo, jobInfo,
          serviceData, roofReportType, roofReportPath, roofReportName,
          orderReport, sameDayDispatch, _savedAt: Date.now(),
        }));
      } catch { /* noop */ }
      setAuthGateOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      // Keep the profile in sync with what was entered on the form
      await supabase.from("client_profiles").upsert({
        user_id: uid,
        company_name: clientInfo.companyName,
        company_address: clientInfo.companyAddress,
        company_city: clientInfo.city,
        company_state: clientInfo.state,
        company_zip: clientInfo.zipCode,
        contact_name: clientInfo.contactName,
        contact_email: clientInfo.email,
        contact_phone: clientInfo.phone,
        terms_accepted_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Upload any additional documents now that we have an authenticated user
      const additionalDocs: { path: string; name: string }[] = [];
      for (const file of uploadedFiles) {
        const safeName = file.name.replace(/[^\w.\-]/g, "_");
        const path = `${uid}/order-docs/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("reports").upload(path, file);
        if (upErr) {
          toast.warning(`Couldn't attach ${file.name} — continuing without it`);
        } else {
          additionalDocs.push({ path, name: file.name });
        }
      }

      const serviceNames = selectedServices.map(
        (id) => ORDER_SERVICES.find((s) => s.id === id)?.name ?? id
      );

      const { data, error } = await supabase.functions.invoke("create-guest-checkout", {
        body: {
          services: selectedServices,
          serviceNames,
          customerEmail: clientInfo.email,
          customerName: clientInfo.companyName,
          clientId: uid,
          jobAddress: jobInfo.jobAddress,
          jobCity: jobInfo.jobCity,
          jobZip: jobInfo.jobZipCode,
          jobCounty: jobInfo.jobCounty,
          jobLat: jobInfo.jobLat,
          jobLng: jobInfo.jobLng,
          gatedCommunity: clientInfo.gatedCommunity === "yes",
          gateCode: clientInfo.gateCode,
          insideAccessName: jobInfo.insideAccessName,
          insideAccessPhone: jobInfo.insideAccessPhone,
          // Pricing inputs — the server recomputes the total from its own
          // catalog; the client amount is sent only as a cross-check.
          roofAreaSqft: roofArea,
          roofHeightFt: roofHeight,
          sameDayDispatch,
          orderReport,
          distanceFee,
          clientAmount: Math.round(total * 100),
          // Rich order details, persisted onto the order row (not Stripe metadata)
          roofReportPath,
          roofReportName: roofReportName ?? roofReport?.name ?? null,
          roofReportType,
          additionalDocs,
          orderDetails: {
            client_info: clientInfo,
            job_info: jobInfo,
            service_data: serviceData,
            special_inspection_types: specialInspectionTypes,
            distance_miles: distanceMiles,
          },
        },
      });

      if (error) throw error;
      sessionStorage.setItem("orderDetails", JSON.stringify({
        projectName: jobInfo.projectName,
        jobAddress: jobInfo.jobAddress,
        serviceCount: selectedServices.length,
        total,
        email: clientInfo.email,
      }));
      if (data?.skipPayment) {
        toast.success("Order submitted successfully!");
        clearDraft();
        window.location.href = "/order?status=success";
        return;
      }
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create checkout session");
    } finally {
      setSubmitting(false);
    }
  };

  // Section completion checks
  const isServicesComplete = selectedServices.length > 0;
  const isClientComplete = !!(
    clientInfo.companyName && clientInfo.email && clientInfo.phone && clientInfo.contactName
  );
  const isJobComplete = !!(jobInfo.jobAddress && jobInfo.jobCity && jobInfo.jobZipCode.length === 5);
  const isUploadComplete = uploadedFiles.length > 0 || !!roofReport;
  const isTermsComplete = previouslyAccepted || termsAccepted;

  // The draft is done once payment succeeded
  useEffect(() => {
    if (isSuccess) clearDraft();
  }, [isSuccess]);

  // ── Success screen ──────────────────────────────────────────────────
  if (isSuccess) {
    let details: { projectName?: string; jobAddress?: string; serviceCount?: number; total?: number; email?: string } | null = null;
    try { details = JSON.parse(sessionStorage.getItem("orderDetails") || "null"); } catch { /* noop */ }
    return (
      <div className="min-h-screen bg-background">
        <HeroNav solid />
        <div className="mx-auto max-w-lg px-4 pt-32 pb-20">
          <div className="rounded-2xl border bg-card shadow-elevated p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-hvhz-green-light">
              <CheckCircle2 className="h-8 w-8 text-hvhz-green" />
            </div>
            <h1 className="font-display text-2xl font-bold text-primary">Order received</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {details?.jobAddress
                ? <>Your order for <span className="font-medium text-primary">{details.jobAddress}</span> is in.</>
                : "Your order is in."}{" "}
              {details?.email && <>A confirmation is on its way to <span className="font-medium text-primary">{details.email}</span>.</>}
            </p>

            <div className="mt-6 rounded-lg bg-muted/60 p-4 text-left space-y-2.5">
              {[
                "We review and dispatch your order — same day when possible",
                "Field testing and engineering calculations run",
                "A licensed PE signs and seals your report",
                "Download the sealed PDF from your portal",
              ].map((step, i) => (
                <div key={step} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hvhz-teal/10 text-hvhz-teal text-[10px] font-bold">{i + 1}</span>
                  {step}
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-2.5">
              <Button className="w-full h-11 bg-hvhz-teal text-white hover:bg-hvhz-teal/90" asChild>
                <Link to={user ? "/portal/dashboard" : "/auth"}>
                  {user ? "Track it in your dashboard" : "Sign in to track your order"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full h-11" onClick={() => { sessionStorage.removeItem("orderDetails"); setSearchParams({}); }}>
                Place another order
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HeroNav />
      <OrderHero />

      {user && clientInfo.companyName && (
        <div className="mx-auto max-w-3xl px-4 mt-4">
          <div className="flex items-center gap-2 rounded-lg border border-hvhz-teal/30 bg-hvhz-teal/5 p-3">
            <LogIn className="h-4 w-4 text-hvhz-teal" />
            <p className="text-sm text-hvhz-teal">
              Signed in as <strong>{clientInfo.companyName}</strong> — your info has been pre-filled.
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-3">
        <FormSection
          step={1}
          title="Select Services"
          description="Choose the engineering services you need"
          icon={ShoppingCart}
          isOpen={openSections.services ?? false}
          isComplete={isServicesComplete}
          onToggle={() => toggleSection("services")}
          hasError={!!errors.services}
        >
          <ServiceSelection
            selectedServices={selectedServices}
            onToggleService={toggleService}
            specialInspectionTypes={specialInspectionTypes}
            onToggleInspectionType={toggleInspectionType}
          />
          {errors.services && <p className="text-xs text-destructive mt-2">{errors.services}</p>}
        </FormSection>

        <FormSection
          step={2}
          title="Client Information"
          description="Your company and contact details"
          icon={User}
          isOpen={openSections.client ?? false}
          isComplete={isClientComplete}
          onToggle={() => toggleSection("client")}
        >
          <ClientInfoForm
            data={clientInfo}
            onChange={setClientInfo}
            errors={errors}
            isLoggedIn={!!user}
          />
        </FormSection>

        <FormSection
          step={3}
          title="Job Information"
          description="Job site address and roof details"
          icon={MapPin}
          isOpen={openSections.job ?? false}
          isComplete={isJobComplete}
          onToggle={() => toggleSection("job")}
        >
          <JobInfoForm
            data={jobInfo}
            onChange={setJobInfo}
            errors={errors}
            requireRoofDetails={requireRoofDetails}
          />
        </FormSection>

        {selectedServices.length > 0 && (
          <FormSection
            step={4}
            title="Service Details"
            description="Additional info for selected services"
            icon={Settings2}
            isOpen={openSections.serviceDetails ?? false}
            isComplete={false}
            onToggle={() => toggleSection("serviceDetails")}
          >
            <ServiceSpecificFields
              selectedServices={selectedServices}
              data={serviceData}
              onChange={setServiceData}
              roofArea={roofArea}
            />
          </FormSection>
        )}

        <FormSection
          step={5}
          title="Upload Documents"
          description="Roof measurement reports and supporting files"
          icon={Upload}
          isOpen={openSections.upload ?? false}
          isComplete={isUploadComplete}
          onToggle={() => toggleSection("upload")}
        >
          <FileUploadSection
            uploadedFiles={uploadedFiles}
            onFilesChange={setUploadedFiles}
            roofReport={roofReport}
            onRoofReportChange={setRoofReport}
            roofReportType={roofReportType}
            onRoofReportTypeChange={setRoofReportType}
            orderReport={orderReport}
            onOrderReportChange={setOrderReport}
            onRoofAreaExtracted={(area) =>
              setJobInfo((prev) => ({ ...prev, roofArea: String(area) }))
            }
            onRoofReportUploaded={(path, name) => {
              setRoofReportPath(path);
              setRoofReportName(name);
            }}
          />
        </FormSection>

        <FormSection
          step={6}
          title="Pricing Summary"
          description="Live pricing breakdown"
          icon={DollarSign}
          isOpen={openSections.pricing ?? false}
          isComplete={selectedServices.length > 0}
          onToggle={() => toggleSection("pricing")}
        >
          <PricingSection
            selectedServices={selectedServices}
            roofArea={roofArea}
            roofHeight={roofHeight}
            sameDayDispatch={sameDayDispatch}
            onSameDayChange={setSameDayDispatch}
            distanceFee={distanceFee}
            distanceMiles={distanceMiles}
            orderReport={orderReport}
          />
        </FormSection>

        <FormSection
          step={7}
          title="Terms & Payment"
          description="Review terms and submit your order"
          icon={FileCheck}
          isOpen={openSections.terms ?? false}
          isComplete={isTermsComplete}
          onToggle={() => toggleSection("terms")}
          hasError={!!errors.terms}
        >
          <TermsAndPayment
            termsAccepted={termsAccepted}
            onTermsChange={setTermsAccepted}
            previouslyAccepted={previouslyAccepted}
            total={total}
            onSubmit={() => handleSubmit()}
            submitting={submitting}
            errors={errors}
          />
        </FormSection>
      </div>

      <AuthGateDialog
        open={authGateOpen}
        onOpenChange={setAuthGateOpen}
        defaultEmail={clientInfo.email}
        companyName={clientInfo.companyName}
        contactName={clientInfo.contactName}
        onAuthed={(userId) => {
          setAuthGateOpen(false);
          handleSubmit(userId);
        }}
      />

      <footer className="hero-gradient text-primary-foreground px-6 py-10 mt-12 border-t border-white/5">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-tight text-white/80">HVHZ Engineering LLC</p>
            <p className="text-[10px] text-white/30 font-mono mt-1">
              750 E Sample Rd · Pompano Beach, FL 33064
            </p>
          </div>
          <div className="flex gap-4 text-xs text-white/40">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/auth" className="hover:text-white transition-colors">Sign In</Link>
          </div>
        </div>
        <div className="mx-auto max-w-3xl mt-4 pt-4 border-t border-white/5">
          <p className="text-[10px] text-white/20 font-mono text-center">
            © 2026 HVHZ Engineering LLC · FL PE Licensed & Insured
          </p>
        </div>
      </footer>
    </div>
  );
}
