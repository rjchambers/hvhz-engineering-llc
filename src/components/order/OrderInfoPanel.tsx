import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ExternalLink,
  MapPin,
  Building2,
  User,
  Phone,
  Mail,
  Lock,
  ClipboardList,
  StickyNote,
  Wrench,
  Home,
} from "lucide-react";
import { ORDER_SERVICES } from "@/components/order/orderServices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface OrderInfoData {
  job_address?: string | null;
  job_city?: string | null;
  job_zip?: string | null;
  job_county?: string | null;
  services?: string[] | null;
  notes?: string | null;
  gated_community?: boolean | null;
  gate_code?: string | null;
  roof_area_sqft?: number | null;
  roof_data?: Record<string, any> | null;
  site_context?: Record<string, any> | null;
  noa_document_path?: string | null;
  noa_document_name?: string | null;
  noa_system_number?: string | null;
  roof_report_path?: string | null;
  roof_report_name?: string | null;
  roof_report_type?: string | null;
  total_amount?: number | null;
  distance_fee?: number | null;
  created_at?: string | null;
}

export interface ClientInfoData {
  company_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  company_address?: string | null;
  company_city?: string | null;
  company_state?: string | null;
  company_zip?: string | null;
  contractor_license?: string | null;
  preferred_contact?: string | null;
  tech_instructions?: string | null;
}

interface Props {
  order: OrderInfoData | null | undefined;
  client?: ClientInfoData | null;
  workOrderServiceType?: string;
  workOrderRejectionNotes?: string | null;
  /** Show the wide variant (full panel). Default true. */
  expanded?: boolean;
}

const serviceLabel = (id: string) =>
  ORDER_SERVICES.find((s) => s.id === id)?.name ?? id;

async function openSignedDoc(path: string) {
  const { data, error } = await supabase.storage.from("reports").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    toast({ title: "Could not open file", description: error?.message, variant: "destructive" });
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "" || value === "—") return null;
  return (
    <div className="flex gap-2 text-sm">
      {Icon && <Icon className="h-4 w-4 text-hvhz-teal shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-primary border-b pb-1">{title}</h3>
      {children}
    </section>
  );
}

export function OrderInfoPanel({ order, client, workOrderServiceType, workOrderRejectionNotes }: Props) {
  if (!order) return null;
  const site = (order.site_context as Record<string, any>) ?? {};
  const roof = (order.roof_data as Record<string, any>) ?? {};
  const fullAddress = [order.job_address, order.job_city, "FL", order.job_zip].filter(Boolean).join(", ");
  const companyAddress = [client?.company_address, client?.company_city, client?.company_state, client?.company_zip]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="bg-card border rounded-lg p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-primary">Order Details</h2>
        {workOrderServiceType && (
          <Badge variant="outline" className="text-xs">
            Work Order: {serviceLabel(workOrderServiceType)}
          </Badge>
        )}
      </div>

      {workOrderRejectionNotes && (
        <div className="bg-destructive/10 border border-destructive/30 rounded p-3">
          <p className="text-xs font-semibold text-destructive mb-1">Sent Back for Revision</p>
          <p className="text-xs text-foreground/80">{workOrderRejectionNotes}</p>
        </div>
      )}

      {/* CLIENT */}
      {client && (
        <Section title="Client & Contact">
          <div className="grid sm:grid-cols-2 gap-3">
            <Row icon={Building2} label="Company" value={client.company_name} />
            <Row icon={User} label="Contact Name" value={client.contact_name} />
            <Row icon={Mail} label="Email" value={client.contact_email} />
            <Row icon={Phone} label="Phone" value={client.contact_phone} />
            <Row icon={ClipboardList} label="Contractor License" value={client.contractor_license} />
            <Row label="Preferred Contact" value={client.preferred_contact} />
            {companyAddress && <Row icon={MapPin} label="Company Address" value={companyAddress} />}
          </div>
          {client.tech_instructions && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
                Standing Instructions for Technician
              </p>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap">{client.tech_instructions}</p>
            </div>
          )}
        </Section>
      )}

      {/* JOB SITE */}
      <Section title="Job Site">
        <div className="grid sm:grid-cols-2 gap-3">
          <Row icon={MapPin} label="Address" value={fullAddress || "—"} />
          <Row label="County" value={order.job_county || site.county} />
          {order.gated_community && (
            <Row
              icon={Lock}
              label="Gated Community"
              value={order.gate_code ? `Yes · Gate Code: ${order.gate_code}` : "Yes"}
            />
          )}
          <Row icon={User} label="Inside Access Contact" value={site.inside_access_name} />
          <Row icon={Phone} label="Inside Access Phone" value={site.inside_access_phone} />
          <Row label="Wind Zone" value={site.wind_zone} />
          <Row label="Exposure Category" value={site.exposure_category} />
          <Row label="Distance from Office" value={site.distance_miles ? `${site.distance_miles} mi` : null} />
        </div>
      </Section>


      {/* ROOF */}
      {(roof.area || roof.pitch || roof.type || order.roof_area_sqft) && (
        <Section title="Roof Information">
          <div className="grid sm:grid-cols-2 gap-3">
            <Row icon={Home} label="Roof Area" value={roof.area ? `${roof.area} sq ft` : order.roof_area_sqft ? `${order.roof_area_sqft} sq ft` : null} />
            <Row label="Roof Pitch" value={roof.pitch} />
            <Row label="Roof Type" value={roof.type} />
            <Row label="Stories" value={roof.stories} />
            <Row label="Year Built" value={roof.year_built} />
          </div>
        </Section>
      )}

      {/* SERVICES ORDERED */}
      {order.services && order.services.length > 0 && (
        <Section title="All Services Ordered">
          <div className="flex flex-wrap gap-2">
            {order.services.map((s) => (
              <Badge
                key={s}
                variant={s === workOrderServiceType ? "default" : "outline"}
                className="text-xs"
              >
                <Wrench className="h-3 w-3 mr-1" />
                {serviceLabel(s)}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* CLIENT NOTES */}
      {order.notes && (
        <Section title="Client Notes / Special Instructions">
          <div className="flex gap-2 rounded-md bg-muted/40 border p-3">
            <StickyNote className="h-4 w-4 text-hvhz-teal shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{order.notes}</p>
          </div>
        </Section>
      )}

      {/* DOCUMENTS */}
      {(order.noa_document_path || order.roof_report_path) && (
        <Section title="Client-Provided Documents">
          <div className="space-y-2">
            {order.noa_document_path && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <FileText className="h-5 w-5 text-hvhz-teal shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">
                    NOA Document
                    {order.noa_system_number && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (System #{order.noa_system_number})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.noa_document_name || order.noa_document_path}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openSignedDoc(order.noa_document_path!)}>
                  <ExternalLink className="h-3 w-3" /> Open
                </Button>
              </div>
            )}
            {order.roof_report_path && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <FileText className="h-5 w-5 text-hvhz-teal shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">
                    Measurement Report
                    {order.roof_report_type && (
                      <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                        {order.roof_report_type}
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.roof_report_name || order.roof_report_path}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openSignedDoc(order.roof_report_path!)}>
                  <ExternalLink className="h-3 w-3" /> Open
                </Button>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
