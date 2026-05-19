# Lovable Prompt: Fix Paid Orders Not Appearing in Pipeline

Copy everything below this line into Lovable as a single prompt.

---

We have a critical bug: orders placed through the public order form are being paid successfully via Stripe, but they never appear in our admin pipeline. The Stripe webhook is silently failing to insert the order into the database.

## Root cause

There is a Stripe metadata key mismatch between the guest checkout function and the webhook handler:

- `supabase/functions/create-guest-checkout/index.ts` stores the customer's id in Stripe session metadata as `metadata[userId]`.
- `supabase/functions/stripe-webhook/index.ts` reads it back as `session.metadata.clientId`.

Because the keys don't match, `clientId` is `undefined` in the webhook. When the webhook then tries to `INSERT` into the `orders` table, it violates the `client_id NOT NULL` constraint, so the order (and its work_orders) are never created. The pipeline shows nothing despite Stripe confirming the payment.

The portal flow (`create-stripe-checkout`) is unaffected because it already uses `metadata[clientId]`.

There is a secondary issue: the normal Stripe path in `create-guest-checkout` does not validate that a `client_id` is available before creating a Stripe session, so a true guest (no account) can still pay even though our schema requires `client_id`.

## Please make these exact changes

### Change 1 — `supabase/functions/create-guest-checkout/index.ts`

Find this block (it's the start of the "Normal Stripe flow" after the `bypassActive` check):

```ts
    // Normal Stripe flow
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = Deno.env.get("APP_URL") || "https://hvhzengineering.com";

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("customer_email", customerEmail);
    params.append("success_url", `${appUrl}/order?status=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${appUrl}/order`);

    params.append("metadata[services]", JSON.stringify(services));
    params.append("metadata[serviceNames]", JSON.stringify(serviceNames || []));
    params.append("metadata[customerEmail]", customerEmail);
    params.append("metadata[customerName]", customerName || "");
    params.append("metadata[jobAddress]", jobAddress || "");
    params.append("metadata[jobCity]", jobCity || "");
    params.append("metadata[jobZip]", jobZip || "");
    params.append("metadata[jobCounty]", jobCounty || "");
    params.append("metadata[gatedCommunity]", String(gatedCommunity || false));
    params.append("metadata[gateCode]", gateCode || "");
    params.append("metadata[isGuestOrder]", String(!!isGuestOrder));
    params.append("metadata[userId]", userId || "");
```

Replace it with:

```ts
    // Normal Stripe flow
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The orders table requires a non-null client_id (auth.users FK), so we
    // must know the client before charging. Prefer the userId validated from
    // the auth header; fall back to the clientId in the body for safety.
    const effectiveClientId = userId || clientId;
    if (!effectiveClientId) {
      return new Response(
        JSON.stringify({ error: "An account is required to place an order. Please sign in or create an account before checking out." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://hvhzengineering.com";

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("customer_email", customerEmail);
    params.append("success_url", `${appUrl}/order?status=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${appUrl}/order`);

    params.append("metadata[clientId]", effectiveClientId);
    params.append("metadata[services]", JSON.stringify(services));
    params.append("metadata[serviceNames]", JSON.stringify(serviceNames || []));
    params.append("metadata[customerEmail]", customerEmail);
    params.append("metadata[customerName]", customerName || "");
    params.append("metadata[jobAddress]", jobAddress || "");
    params.append("metadata[jobCity]", jobCity || "");
    params.append("metadata[jobZip]", jobZip || "");
    params.append("metadata[jobCounty]", jobCounty || "");
    params.append("metadata[gatedCommunity]", String(gatedCommunity || false));
    params.append("metadata[gateCode]", gateCode || "");
    params.append("metadata[isGuestOrder]", String(!!isGuestOrder));
```

Key differences:
- Adds a validation block that requires `userId || clientId` before creating a Stripe session.
- Sends `metadata[clientId]` instead of `metadata[userId]` so the webhook can read it.

### Change 2 — `supabase/functions/stripe-webhook/index.ts`

Find this line:

```ts
    const session = event.data.object;
    const clientId = session.metadata?.clientId;
    const services: string[] = JSON.parse(session.metadata?.services || "[]");
```

Replace it with:

```ts
    const session = event.data.object;
    // Fall back to legacy `userId` metadata key for in-flight checkouts created
    // before guest checkout was switched to `clientId`.
    const clientId = session.metadata?.clientId || session.metadata?.userId;
    if (!clientId) {
      console.error("stripe-webhook: missing client_id in session metadata", {
        session_id: session.id,
        metadata_keys: Object.keys(session.metadata || {}),
      });
      return new Response("Missing client_id in metadata", { status: 400 });
    }
    const services: string[] = JSON.parse(session.metadata?.services || "[]");
```

Then find this block:

```ts
    if (orderErr) {
      console.error("Order insert error:", orderErr);
      return new Response("Failed to create order", { status: 500 });
    }
```

Replace it with:

```ts
    if (orderErr) {
      console.error("Order insert error:", {
        error: orderErr,
        session_id: session.id,
        client_id: clientId,
      });
      return new Response("Failed to create order", { status: 500 });
    }
```

Key differences:
- Accepts the legacy `metadata.userId` key as a fallback so any in-flight Stripe sessions created before this fix is deployed still resolve correctly.
- Returns 400 (with diagnostic logging) instead of attempting the insert when no client_id is present.
- Logs `session_id` and `client_id` on insert failures so future issues are diagnosable in the Supabase function logs.

## Do not change

- Do not change `supabase/functions/create-stripe-checkout/index.ts` — it already correctly uses `metadata[clientId]`.
- Do not change the orders table schema or RLS policies.
- Do not change `src/pages/admin/Pipeline.tsx` — the pipeline query is fine; it just had nothing to display because rows were never inserted.

## After the fix is deployed

1. Stripe automatically retries failed webhooks for up to 3 days, so any failed deliveries still within that window should be redelivered and create the missing orders on their own.
2. For older paid sessions outside Stripe's retry window, manually replay the `checkout.session.completed` events from the Stripe Dashboard: **Developers → Webhooks → (your endpoint) → Event deliveries → Resend**.
3. Verify by placing a test order through the public order form (`/order`) and confirming it appears in the admin pipeline.
