import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// std@0.168.0 exports `encode`/`decode` here (renamed to encodeBase64 in later
// releases). Alias it so the pinned version boots correctly.
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Default email used when a partner has no custom template configured.
const DEFAULT_TEMPLATE = `Hello {{contact_name}},

HVHZ Engineering requests {{service_name}} for the job below.

Job site: {{job_address}}, {{job_city}} {{job_zip}}
Contractor: {{client_company}}
Reference WO#: {{work_order_id}}
Requested date: {{scheduled_date}}

The associated documents are attached. Please perform the test and email
results to admin@hvhz.us referencing the WO# above.

Thank you,
HVHZ Engineering`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return json({ error: "Email service not configured" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller and require admin role.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return json({ error: "Forbidden: admin role required" }, 403);

    const { workOrderId, partnerId } = await req.json();
    if (!workOrderId) return json({ error: "Missing workOrderId" }, 400);

    // Load the work order + its order (for job details and submitted files).
    const { data: wo, error: woErr } = await supabaseAdmin
      .from("work_orders")
      .select("id, service_type, client_id, scheduled_date, orders(job_address, job_city, job_zip, notes, noa_document_path, noa_document_name, roof_report_path, roof_report_name, roof_data)")
      .eq("id", workOrderId)
      .single();
    if (woErr || !wo) return json({ error: "Work order not found" }, 404);

    const order = (wo.orders ?? {}) as Record<string, any>;

    // Resolve the partner: explicit partnerId, otherwise the single active
    // partner that covers this service type (auto-select).
    let partnerQuery = supabaseAdmin
      .from("outsource_partners")
      .select("id, name, contact_name, contact_email, services, email_template, active")
      .eq("active", true);
    if (partnerId) partnerQuery = partnerQuery.eq("id", partnerId);
    const { data: partners, error: partnersErr } = await partnerQuery;
    if (partnersErr) return json({ error: "Failed to load partners" }, 500);

    const candidates = (partners ?? []).filter((p) =>
      (p.services ?? []).includes(wo.service_type)
    );

    if (candidates.length === 0) {
      return json({ error: `No active lab partner handles ${wo.service_type}` }, 400);
    }
    if (!partnerId && candidates.length > 1) {
      return json({ error: "Multiple partners match this service; choose one", ambiguous: true }, 409);
    }
    const partner = candidates[0];

    // Look up the ordering client's company for the template.
    const { data: clientProfile } = await supabaseAdmin
      .from("client_profiles")
      .select("company_name, contact_email")
      .eq("user_id", wo.client_id)
      .maybeSingle();

    // Resolve template variables.
    const vars: Record<string, string> = {
      "{{contact_name}}": partner.contact_name ?? "there",
      "{{service_name}}": wo.service_type,
      "{{job_address}}": order.job_address ?? "",
      "{{job_city}}": order.job_city ?? "",
      "{{job_zip}}": order.job_zip ?? "",
      "{{client_company}}": clientProfile?.company_name ?? "",
      "{{work_order_id}}": String(wo.id).slice(0, 8).toUpperCase(),
      "{{scheduled_date}}": wo.scheduled_date ?? "TBD",
    };
    const rawTemplate = partner.email_template?.trim() || DEFAULT_TEMPLATE;
    const resolved = Object.entries(vars).reduce(
      (text, [token, value]) => text.replaceAll(token, value),
      rawTemplate
    );
    const html = escapeHtml(resolved).replace(/\n/g, "<br>");

    // Download the submitted files and attach them — including any
    // additional documents the client uploaded with the order.
    const additionalDocs: { path?: string; name?: string }[] =
      Array.isArray(order.roof_data?.additional_documents) ? order.roof_data.additional_documents : [];
    const fileSpecs = [
      { path: order.noa_document_path, name: order.noa_document_name },
      { path: order.roof_report_path, name: order.roof_report_name },
      ...additionalDocs.map((d) => ({ path: d.path, name: d.name })),
    ].filter((f) => f.path);

    const attachments: { filename: string; content: string }[] = [];
    const missing: string[] = [];
    for (const spec of fileSpecs) {
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from("reports")
        .download(spec.path as string);
      if (dlErr || !blob) {
        console.error("Attachment download failed:", spec.path, dlErr);
        missing.push(spec.name || (spec.path as string));
        continue;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const filename = spec.name || (spec.path as string).split("/").pop() || "document.pdf";
      attachments.push({ filename, content: encodeBase64(bytes) });
    }

    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "admin@hvhz.us";
    const subject = `Test Request — ${vars["{{service_name}}"]} — WO#${vars["{{work_order_id}}"]}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "HVHZ Engineering <noreply@workorder.hvhz.us>",
        to: partner.contact_name
          ? `${partner.contact_name} <${partner.contact_email}>`
          : partner.contact_email,
        cc: adminEmail,
        subject,
        html,
        attachments,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      return json({ error: "Failed to send dispatch email" }, 502);
    }

    // Only now — after a confirmed send — mark the work order dispatched.
    const { error: updateErr } = await supabaseAdmin
      .from("work_orders")
      .update({
        status: "dispatched",
        outsource_company: partner.name,
        outsource_email_sent_at: new Date().toISOString(),
      })
      .eq("id", wo.id);
    if (updateErr) {
      console.error("Work order update failed after email:", updateErr);
      return json({ error: "Email sent but failed to update work order", emailSent: true }, 500);
    }

    return json({
      success: true,
      partner: partner.name,
      attached: attachments.map((a) => a.filename),
      missing,
    });
  } catch (err) {
    console.error("dispatch-to-lab error:", err);
    return json({ error: String(err) }, 500);
  }
});
