import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultRouteForRoles, getUserRoles } from "@/lib/authz";
import { useInView } from "@/hooks/useInView";
import { HeroNav } from "@/components/HeroNav";
import { FloatingCalcCard } from "@/components/hero/FloatingCalcCard";
import { StatsBar } from "@/components/hero/StatsBar";
import { ORDER_SERVICES } from "@/components/order/orderServices";
import {
  Crosshair, Layers, Droplets, CloudRain, HardHat, Wind, ArrowUpFromLine,
  Shield, Clock, FileCode2, ArrowRight, TestTube2, MessageSquarePlus,
  LayoutDashboard, RefreshCw, Percent, Zap, FolderDown, MapPin, Mail,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

/**
 * Landing-page presentation for each service. Prices come from ORDER_SERVICES
 * (the same catalog the order flow charges from) so the site can never
 * under- or over-quote.
 */
const SERVICE_META: Record<string, { icon: LucideIcon; code: string; description: string }> = {
  "tas-105": { icon: Crosshair, code: "TAS 105-20 · HVHZ", description: "Field withdrawal resistance testing of mechanical fasteners for reroof permits." },
  "tas-106": { icon: Layers, code: "TAS 106 · HVHZ", description: "Field verification of mortar-set and adhesive-set tile systems." },
  "tas-126": { icon: Droplets, code: "TAS 126-95 · HVHZ", description: "Infrared thermographic moisture survey for reroof permits." },
  "drainage-analysis": { icon: CloudRain, code: "FBC 1611 · NOAA Atlas 14", description: "Hydraulic roof drainage calculation using NOAA Atlas 14 rainfall data." },
  "fastener-calculation": { icon: ArrowUpFromLine, code: "ASCE 7-22 · RAS 117", description: "Engineering calculation of required fastener spacing and uplift capacity." },
  "special-inspection": { icon: HardHat, code: "FBC Ch. 17", description: "Threshold and special inspector services for permit close-out." },
  "wind-mitigation-permit": { icon: Wind, code: "ASCE 7-22 · FBC 1609", description: "Wind pressure analysis for roofing permits in the High Velocity Hurricane Zone." },
  "asbestos-survey": { icon: TestTube2, code: "EPA · NESHAP", description: "Asbestos content survey and sampling for reroof and demolition projects." },
};

function servicePriceLabel(base: number, perSquare: number): string {
  if (base === 0) return "Quoted";
  return perSquare > 0 ? `From $${base}` : `$${base}`;
}

const landingServices = ORDER_SERVICES.filter((s) => s.id !== "other").map((s) => ({
  id: s.id,
  name: s.name,
  price: servicePriceLabel(s.base, s.perSquare),
  perSquare: s.perSquare,
  ...SERVICE_META[s.id],
}));

const howItWorks = [
  { step: 1, title: "Order online", description: "Pick your services, enter the job site, and check out securely — it takes minutes, not phone calls." },
  { step: 2, title: "We test & calculate", description: "Field testing is dispatched same-day when needed, while our calculation engine runs the numbers under licensed-PE oversight." },
  { step: 3, title: "Sealed report delivered", description: "A licensed Florida PE reviews, signs, and seals your permit-ready report. Download it straight from your portal." },
];

const contractorFeatures = [
  { icon: LayoutDashboard, title: "Live job tracking", description: "Every order moves through a visible pipeline — dispatched, in progress, under PE review, sealed. No status calls." },
  { icon: RefreshCw, title: "Saved sites & reorder", description: "Your job sites and company details are remembered. Repeat orders take a couple of clicks." },
  { icon: Percent, title: "Volume discounts", description: "5% off two services, 10% off three, 15% off four or more — applied automatically at checkout." },
  { icon: Zap, title: "Same-day dispatch", description: "Need it moving today? Same-day field dispatch is available on qualifying orders." },
  { icon: FolderDown, title: "Sealed PDFs on demand", description: "Signed and sealed reports live in your portal — download, forward, and file them with permits anytime." },
  { icon: Shield, title: "Licensed & accountable", description: "Every deliverable is reviewed, signed, and sealed by a licensed Florida Professional Engineer." },
];

const trustSignals = [
  { icon: Shield, title: "FL PE licensed", description: "Every report is signed and sealed by a licensed Florida Professional Engineer." },
  { icon: Zap, title: "Automation + oversight", description: "Automated engineering calculations, verified by a human PE on every order." },
  { icon: Clock, title: "Built for deadlines", description: "Most reports are delivered within 24 hours of field inspection completion." },
  { icon: FileCode2, title: "Code-first approach", description: "FBC 8th Edition, ASCE 7-22, RAS 117/128, TAS — cited in every report." },
];

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isInView } = useInView();
  return (
    <div
      ref={ref}
      className={cn(isInView ? "reveal" : "opacity-0", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Own component so useInView isn't called inside a .map() (Rules of Hooks). */
function ServiceCard({ service, index }: { service: (typeof landingServices)[number]; index: number }) {
  const { ref, isInView } = useInView();
  const Icon = service.icon;
  return (
    <div
      ref={ref}
      className={cn(
        "group relative rounded-xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-elevated-hover hover:-translate-y-1 hover:border-hvhz-teal/30",
        isInView ? "reveal" : "opacity-0"
      )}
      style={{ animationDelay: `${(index % 3) * 80}ms` }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-hvhz-teal/10 text-hvhz-teal transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-right">
            <span className="block font-display text-lg font-bold tabular-nums text-primary leading-none">
              {service.price}
            </span>
            {service.perSquare > 0 && (
              <span className="block mt-1 text-[10px] text-muted-foreground font-mono">+${service.perSquare.toFixed(2)}/sq ft</span>
            )}
          </div>
        </div>
        <h3 className="text-[15px] font-semibold text-primary leading-snug">
          {service.name}
        </h3>
        {service.code && (
          <span className="mt-2 inline-block text-[10px] font-mono tracking-wide text-hvhz-teal bg-hvhz-teal/[0.07] px-2 py-0.5 rounded">
            {service.code}
          </span>
        )}
        <p className="mt-2.5 text-[13px] text-muted-foreground leading-relaxed">
          {service.description}
        </p>
      </div>
      <div className="h-[3px] bg-gradient-to-r from-transparent via-hvhz-teal to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
}

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    let cancelled = false;
    if (loading || !user) return;
    getUserRoles(user.id).then((roles) => {
      if (cancelled) return;
      navigate(getDefaultRouteForRoles(roles), { replace: true });
    });
    return () => { cancelled = true; };
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <HeroNav />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden hero-gradient px-6 pt-32 pb-24 md:pt-44 md:pb-32">
        <div className="absolute inset-0 grid-pattern opacity-60" />

        <div className="relative mx-auto max-w-6xl flex items-center gap-16">
          <div className="flex-1 max-w-xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 bg-white/[0.06] px-3 py-1.5 rounded-full border border-white/10 mb-8">
              <MapPin className="h-3 w-3 text-hvhz-teal" />
              Miami-Dade · Broward · Palm Beach
            </span>

            <h1 className="text-display text-4xl md:text-5xl lg:text-[3.4rem] text-white">
              Permit-ready roof engineering,{" "}
              <span className="text-gradient-teal">sealed in hours.</span>
            </h1>

            <p className="mt-6 text-lg text-white/60 leading-relaxed max-w-lg">
              Field testing, calculations, and PE-sealed reports for South
              Florida's High Velocity Hurricane Zone — ordered online, tracked
              live, delivered fast.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="bg-hvhz-teal text-white hover:bg-hvhz-teal/90 active:scale-[0.97] transition-all shadow-lg shadow-hvhz-teal/25 text-base h-12 px-7"
                asChild
              >
                <Link to="/order">
                  Start an order <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white h-12 px-7 text-base"
                asChild
              >
                <a href="#services">Explore services</a>
              </Button>
            </div>

            <p className="mt-12 text-[11px] text-white/40 font-mono tracking-wider">
              FBC 8TH EDITION · ASCE 7-22 · RAS 117/128 · TAS 105-20 · NOAA ATLAS 14
            </p>
          </div>

          <div className="hidden lg:flex flex-1 justify-center">
            <FloatingCalcCard />
          </div>
        </div>
      </section>

      <StatsBar />

      {/* ── Services ─────────────────────────────────────────── */}
      <section id="services" className="scroll-mt-20 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <AnimatedSection className="max-w-2xl">
            <p className="text-label-upper text-hvhz-teal mb-3">Services & pricing</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight">
              Everything a reroof permit needs.
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Transparent, flat pricing on Florida Building Code testing and
              engineering. What you see here is exactly what checkout charges.
            </p>
          </AnimatedSection>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {landingServices.map((service, i) => (
              <ServiceCard key={service.id} service={service} index={i} />
            ))}
          </div>

          <AnimatedSection className="mt-8">
            <Link
              to="/order"
              className="inline-flex items-center gap-2 text-sm font-medium text-hvhz-teal hover:underline"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Need something else? Submit a custom request
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section id="process" className="scroll-mt-20 relative px-6 py-20 md:py-28 bg-card border-y">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <div className="relative mx-auto max-w-4xl">
          <AnimatedSection className="text-center">
            <p className="text-label-upper text-hvhz-teal mb-3">How it works</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight">
              Order to sealed report in three steps.
            </h2>
          </AnimatedSection>

          <div className="mt-14 grid gap-8 md:grid-cols-3 relative">
            <div className="hidden md:block absolute top-8 left-[calc(33.33%)] right-[calc(33.33%)] h-0 border-t-2 border-dashed border-hvhz-teal/20" />

            {howItWorks.map((item, i) => (
              <AnimatedSection key={item.step} delay={i * 100}>
                <div className="flex flex-col items-center text-center rounded-2xl border bg-background p-8 shadow-elevated hover:-translate-y-1 hover:shadow-elevated-hover transition-all duration-300 h-full">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hvhz-teal text-white font-display font-bold text-xl mb-5">
                    {item.step}
                  </div>
                  <h3 className="text-base font-semibold text-primary mb-2">{item.title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── For contractors ──────────────────────────────────── */}
      <section id="contractors" className="scroll-mt-20 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <AnimatedSection className="max-w-2xl">
            <p className="text-label-upper text-hvhz-teal mb-3">For roofing contractors</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight">
              Built to carry a heavy book of work.
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Running dozens of jobs at once? The portal keeps every order,
              document, and deadline in one place — so your office staff spends
              minutes on compliance paperwork, not afternoons.
            </p>
          </AnimatedSection>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {contractorFeatures.map((f, i) => (
              <AnimatedSection key={f.title} delay={(i % 3) * 80}>
                <div className="rounded-xl border bg-card p-6 h-full hover:-translate-y-0.5 hover:shadow-elevated-hover transition-all duration-300">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-hvhz-teal/10 text-hvhz-teal mb-4">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-primary">{f.title}</h3>
                  <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection className="mt-10">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-7"
              asChild
            >
              <Link to="/auth">
                Create your account <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Credentials ──────────────────────────────────────── */}
      <section className="px-6 py-20 md:py-28 bg-card border-y">
        <div className="mx-auto max-w-5xl grid gap-12 md:grid-cols-5">
          <AnimatedSection className="md:col-span-2">
            <p className="text-label-upper text-hvhz-teal mb-3">Why HVHZ</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight leading-tight">
              Built for hurricane country.
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              We focus on one thing: South Florida's High Velocity Hurricane
              Zone. Automated calculations plus licensed-PE review on every
              order — permit-ready, code-cited, and sealed.
            </p>
            <div className="mt-8 flex gap-3">
              {["FL PE", "FBC", "HVHZ"].map((badge) => (
                <div
                  key={badge}
                  className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-hvhz-teal/20 bg-hvhz-teal/5"
                >
                  <span className="text-[11px] font-mono font-bold text-hvhz-teal">{badge}</span>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <div className="md:col-span-3 grid gap-4 sm:grid-cols-2">
            {trustSignals.map((signal, i) => (
              <AnimatedSection key={signal.title} delay={i * 80}>
                <div className="rounded-xl border bg-background p-6 flex items-start gap-4 hover:-translate-y-0.5 hover:shadow-elevated-hover transition-all duration-300 h-full">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-hvhz-teal/10 text-hvhz-teal">
                    <signal.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-primary">{signal.title}</h3>
                    <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{signal.description}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden hero-gradient px-6 py-20 md:py-24">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="relative mx-auto max-w-3xl text-center">
          <AnimatedSection>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight">
              Ready when your next permit is.
            </h2>
            <p className="mt-4 text-white/60 text-base">
              Order in minutes. Track it live. Download the sealed report.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Button
                size="lg"
                className="bg-hvhz-teal text-white hover:bg-hvhz-teal/90 shadow-lg shadow-hvhz-teal/25 h-12 px-7 text-base"
                asChild
              >
                <Link to="/order">
                  Start an order <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white h-12 px-7 text-base"
                asChild
              >
                <Link to="/auth">Sign in to your portal</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer id="contact" className="scroll-mt-20 bg-primary text-primary-foreground px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <BrandMark size="md" variant="light" />
              <p className="mt-5 text-[13px] text-primary-foreground/60 leading-relaxed max-w-xs">
                Roof engineering and field testing for South Florida's High
                Velocity Hurricane Zone. Licensed, code-first, and built for
                contractor deadlines.
              </p>
              <div className="mt-5 space-y-1.5 text-[13px] text-primary-foreground/60">
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-hvhz-teal" />
                  750 E Sample Rd, Pompano Beach, FL 33064
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-hvhz-teal" />
                  <a href="mailto:admin@hvhz.us" className="hover:text-white transition-colors">admin@hvhz.us</a>
                </p>
              </div>
            </div>
            <div>
              <h4 className="text-label-upper text-primary-foreground/40 mb-4">Explore</h4>
              <ul className="space-y-2.5 text-[13px] text-primary-foreground/60">
                <li><a href="#services" className="hover:text-white transition-colors">Services & pricing</a></li>
                <li><a href="#process" className="hover:text-white transition-colors">How it works</a></li>
                <li><a href="#contractors" className="hover:text-white transition-colors">For contractors</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-label-upper text-primary-foreground/40 mb-4">Account</h4>
              <ul className="space-y-2.5 text-[13px] text-primary-foreground/60">
                <li><Link to="/order" className="hover:text-white transition-colors">Start an order</Link></li>
                <li><Link to="/auth" className="hover:text-white transition-colors">Sign in</Link></li>
                <li><Link to="/auth" className="hover:text-white transition-colors">Create an account</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-primary-foreground/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-primary-foreground/40 font-mono">
              © 2026 HVHZ Engineering LLC · FL PE Licensed
            </p>
            <p className="text-[10px] text-primary-foreground/30 font-mono tracking-wider">
              FBC 8TH EDITION · ASCE 7-22 · RAS 117 · TAS 105-20
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
