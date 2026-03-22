import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ShoppingCart, User, MapPin, Settings2, Upload, DollarSign, FileCheck, LogIn,
} from "lucide-react";
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
  fastenerManufacturer: "",
};

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

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [specialInspectionTypes, setSpecialInspectionTypes] = useState<string[]>([]);
  const [clientInfo, setClientInfo] = useState<ClientInfo>(initialClientInfo);
  const [jobInfo, setJobInfo] = useState<JobInfo>(initialJobInfo);
  const [serviceData, setServiceData] = useState<ServiceSpecificData>(initialServiceData);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [roofReport, setRoofReport] = useState<File | null>(null);
  const [roofReportType, setRoofReportType] = useState("Roofr");
  const [orderReport, setOrderReport] = useState(false);
  const [sameDayDispatch, setSameDayDispatch] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [previouslyAccepted, setPreviouslyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [distanceFee, setDistanceFee] = useState(0);
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    services: true,
  });

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

  const handleSubmit = async () => {
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

    setSubmitting(true);
    try {
      // Upsert profile if logged in
      if (user) {
        await supabase.from("client_profiles").upsert({
          user_id: user.id,
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
      }

      const serviceNames = selectedServices.map(
        (id) => ORDER_SERVICES.find((s) => s.id === id)?.name ?? id
      );

      const metadata = {
        clientInfo,
        jobInfo,
        serviceData,
        specialInspectionTypes,
        sameDayDispatch,
        orderReport,
        roofReportType,
        distanceFee,
        distanceMiles,
        discountPct,
        total,
      };

      const { data, error } = await supabase.functions.invoke("create-guest-checkout", {
        body: {
          services: selectedServices,
          serviceNames,
          customerEmail: clientInfo.email,
          customerName: clientInfo.companyName,
          amount: Math.round(total * 100),
          clientId: user?.id || null,
          jobAddress: jobInfo.jobAddress,
          jobCity: jobInfo.jobCity,
          jobZip: jobInfo.jobZipCode,
          jobCounty: "",
          gatedCommunity: clientInfo.gatedCommunity === "yes",
          gateCode: clientInfo.gateCode,
          metadata: JSON.stringify(metadata),
          isGuestOrder: !user,
        },
      });

      if (error) throw error;
      if (data?.checkoutUrl) {
        sessionStorage.setItem("orderDetails", JSON.stringify({
          projectName: jobInfo.projectName,
          serviceCount: selectedServices.length,
          total,
          email: clientInfo.email,
        }));
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
            onSubmit={handleSubmit}
            submitting={submitting}
            errors={errors}
          />
        </FormSection>
      </div>

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
