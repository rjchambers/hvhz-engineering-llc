import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATES: Record<string, (d: any) => { subject: string; html: string }> = {
  dispatched_tech: (d) => ({
    subject: "New Work Order Assigned",
    html: `<h2>New Work Order Assigned</h2>
<p>You have been assigned a new work order.</p>
<ul>
  <li><strong>Service:</strong> ${d.serviceType ?? ""}</li>
  <li><strong>Job Address:</strong> ${d.jobAddress ?? ""}</li>
  <li><strong>Scheduled Date:</strong> ${d.scheduledDate ?? "TBD"}</li>
</ul>
<p><a href="${d.appUrl}/tech">View in Tech Portal →</a></p>`,
  }),
  dispatched_outsource: (d) => ({
    subject: "Work Order — Test Request",
    html: `<h2>HVHZ Engineering — Test Request</h2>
<p>HVHZ Engineering requests <strong>${d.serviceType}</strong>.</p>
<p><strong>Job site:</strong> ${d.jobAddress}</p>
<p>Please perform the test and email results to <a href="mailto:admin@hvhzengineering.com">admin@hvhzengineering.com</a>.</p>
<p><strong>Reference WO#:</strong> ${d.workOrderId?.slice(0, 8).toUpperCase()}</p>
${d.clientContact ? `<p><strong>Client Contact:</strong> ${d.clientContact}</p>` : ""}
${d.notes ? `<p><strong>Notes:</strong> ${d.notes}</p>` : ""}`,
  }),
  submitted_pe: (d) => ({
    subject: "Report Ready for Review",
    html: `<h2>Report Ready for Review</h2>
<p>A <strong>${d.serviceType}</strong> report is ready for your review.</p>
<p><a href="${d.appUrl}/pe/review/${d.workOrderId}">Review Now →</a></p>`,
  }),
  rejected: (d) => ({
    subject: "PE Returned Work Order for Revision",
    html: `<h2>Work Order Returned for Revision</h2>
<p>The PE has returned a work order for revision.</p>
<p><strong>Rejection Notes:</strong> ${d.rejectionNotes ?? ""}</p>
<p><a href="${d.appUrl}/admin/work-orders">View in Admin →</a></p>`,
  }),
  report_complete: (d) => ({
    subject: "Your Report is Ready",
    html: `<h2>Your Report is Ready</h2>
<p>Your <strong>${d.serviceType}</strong> report for <strong>${d.jobAddress}</strong> is complete and ready to download.</p>
<p><a href="${d.appUrl}/portal/dashboard">View in Portal →</a></p>`,
  }),
  order_confirmed: (d) => ({
    subject: "Order Confirmed",
    html: `<h2>Your Order Has Been Confirmed</h2>
<p>Thank you for your order. We have received your request for the following services:</p>
<p>${d.services ?? ""}</p>
<p><a href="${d.appUrl}/portal/dashboard">View Your Orders →</a></p>`,
  }),
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, recipientEmail, recipientName, extraData } = await req.json();

    if (!type || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing type or recipientEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templateFn = TEMPLATES[type];
    if (!templateFn) {
      return new Response(JSON.stringify({ error: `Unknown template type: ${type}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = Deno.env.get("APP_URL") || "https://hvhzengineering.com";
    const { subject, html } = templateFn({ ...extraData, appUrl });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "HVHZ Engineering <noreply@hvhzengineering.com>",
        to: recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-notification-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
