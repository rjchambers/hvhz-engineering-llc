import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { PortalLayout } from "@/components/PortalLayout";
import { CheckCircle2, ArrowRight, Clock, Wrench, FileCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const STEPS = [
  { icon: Clock, title: "Order Review", desc: "Our team reviews your order and assigns a technician within 1 business day." },
  { icon: Wrench, title: "Field Work", desc: "A certified technician performs the testing or inspection at your job site." },
  { icon: FileCheck, title: "Report Delivery", desc: "A licensed PE reviews, signs, and delivers your sealed engineering report." },
];

export default function OrderConfirmed() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const directOrderId = params.get("order_id");

  const [confirming, setConfirming] = useState(!!sessionId);
  const [orderId, setOrderId] = useState<string | null>(directOrderId);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    let attempts = 0;
    const poll = async () => {
      attempts++;
      const { data } = await supabase
        .from("orders")
        .select("id")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (data) {
        setOrderId(data.id);
        setConfirming(false);
        return;
      }

      if (attempts < 3) {
        setTimeout(poll, 1000);
      } else {
        // Payment went through but webhook may still be processing
        setConfirming(false);
      }
    };

    poll();
  }, [sessionId]);

  if (confirming) {
    return (
      <PortalLayout>
        <div className="px-6 py-16 max-w-2xl mx-auto text-center">
          <Loader2 className="h-10 w-10 animate-spin text-hvhz-teal mx-auto mb-4" />
          <h1 className="text-xl font-bold text-primary">Confirming Payment…</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Please wait while we verify your payment with Stripe.
          </p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="px-6 py-16 max-w-2xl mx-auto text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-hvhz-green/10">
          <CheckCircle2 className="h-8 w-8 text-hvhz-green" />
        </div>

        <h1 className="text-2xl font-bold text-primary">Order Confirmed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your order has been received and is being processed.
          {orderId && <span className="block mt-1 font-mono text-xs">Order ID: {orderId.slice(0, 8)}…</span>}
          {!orderId && sessionId && (
            <span className="block mt-1 text-xs">
              Payment confirmed. Your order is being created and will appear on your dashboard shortly.
            </span>
          )}
        </p>

        <div className="mt-10 text-left">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">What Happens Next</h2>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-4 rounded-lg border bg-card p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-hvhz-teal/10 text-hvhz-teal">
                  <step.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">
                    <span className="text-hvhz-teal mr-1">Step {i + 1}.</span>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <Link to="/portal/orders">View My Orders</Link>
          </Button>
          <Button asChild className="bg-primary text-primary-foreground">
            <Link to="/portal/new-order">Place Another Order <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </PortalLayout>
  );
}
