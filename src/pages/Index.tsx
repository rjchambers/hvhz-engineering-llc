import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultRouteForRoles, getUserRoles } from "@/lib/authz";
import { useInView } from "@/hooks/useInView";
import { HeroNav } from "@/components/HeroNav";
import { FloatingCalcCard } from "@/components/hero/FloatingCalcCard";
import { StatsBar } from "@/components/hero/StatsBar";
import {
  Crosshair, Layers, TestTube2, Droplets, Search, ShieldCheck,
  CloudRain, HardHat, Wind, ArrowUpFromLine, Shield, Zap, Clock,
  FileCode2, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

const services = [
  { name: "TAS-105 Fastener Withdrawal Test", price: "$450", icon: Crosshair, code: "FBC 8th Ed. · HVHZ", description: "Field withdrawal resistance testing of mechanical fasteners per TAS 105-20." },
  { name: "TAS-106 Tile Bonding Verification", price: "$450", icon: Layers, code: "FBC 8th Ed. · HVHZ", description: "Field verification of mortar-set and adhesive-set tile systems per TAS 106." },
  { name: "TAS-124 Membrane Uplift Test", price: "$450", icon: TestTube2, code: "FBC 8th Ed. · HVHZ", description: "In-situ uplift resistance testing of membrane roof systems per TAS 124-20." },
  { name: "TAS-126 Moisture Survey", price: "$450", icon: Droplets, code: "FBC 8th Ed. · HVHZ", description: "Infrared thermographic moisture survey per TAS 126-95 for reroof permits." },
  { name: "Roof Inspection", price: "$350", icon: Search, code: "FBC Ch. 15", description: "Visual and structural condition assessment of decking, flashing, and details." },
  { name: "Roof Certification", price: "$450", icon: ShieldCheck, code: "FBC · 40/50-Year", description: "PE-signed roof condition certification for recertification and transactions." },
  { name: "Drainage Analysis", price: "$550", icon: CloudRain, code: "FBC 1611 · NOAA Atlas 14", description: "Hydraulic roof drainage calculation using NOAA Atlas 14 rainfall data." },
  { name: "Special Inspection", price: "$400", icon: HardHat, code: "FBC Ch. 17", description: "Threshold and special inspector services for permit close-out." },
  { name: "Wind Mitigation", price: "$500", icon: Wind, code: "ASCE 7-22 · FBC 1609", description: "Wind pressure analysis for roofing permits up to 185 mph in HVHZ." },
  { name: "Fastener Uplift Calculation", price: "$350", icon: ArrowUpFromLine, code: "ASCE 7-22 · RAS 117", description: "Engineering calculation of required fastener spacing and uplift capacity." },
];

const trustSignals = [
  { icon: Shield, title: "FL PE Licensed", description: "Every report signed and sealed by a licensed Florida Professional Engineer." },
  { icon: Zap, title: "AI-Powered Calculations", description: "Automated engineering calculations with human PE oversight and verification." },
  { icon: Clock, title: "Same-Day Delivery", description: "Most reports delivered within 24 hours of field inspection completion." },
  { icon: FileCode2, title: "Code-First Approach", description: "Built on FBC 8th Edition, ASCE 7-22, and all applicable Florida standards." },
];

const howItWorks = [
  { step: 1, title: "Order Online", description: "Select your services, enter job site details, and check out securely." },
  { step: 2, title: "We Inspect & Calculate", description: "A certified technician performs field work while our AI engine runs the numbers." },
  { step: 3, title: "Signed Report Delivered", description: "A licensed PE reviews, signs, and seals your permit-ready report." },
];

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isInView } = useInView();
  return (
    <div
      ref={ref}
      className={cn(isInView ? "animate-in" : "opacity-0", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
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

      {/* Hero */}
      <section className="relative overflow-hidden hero-gradient px-6 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="absolute inset-0 grid-pattern opacity-60" />
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-hvhz-teal/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl flex items-center gap-12">
          {/* Left content */}
          <div className="flex-1 max-w-xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-hvhz-teal bg-hvhz-teal/10 px-3 py-1.5 rounded-full border border-hvhz-teal/20 mb-6">
              Serving Palm Beach · Broward · Miami-Dade
            </span>

            <h1 className="text-4xl md:text-5xl lg:text-6xl text-display text-white" style={{ lineHeight: '1.05' }}>
              Roof Engineering{" "}
              <span className="text-gradient-teal">Powered by AI.</span>
            </h1>

            <p className="mt-6 text-lg text-white/50 leading-relaxed max-w-lg" style={{ textWrap: 'balance' as any }}>
              Permit-ready calculations for South Florida's HVHZ.
              Signed and sealed by licensed PEs. Delivered in hours.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="bg-hvhz-teal text-white hover:bg-hvhz-teal/90 active:scale-[0.97] transition-all shadow-lg shadow-hvhz-teal/20 text-base"
                asChild
              >
                <Link to="/order">
                  Order Services <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-white/60 hover:text-white hover:bg-white/10"
                asChild
              >
                <Link to="/auth">Sign In</Link>
              </Button>
            </div>

            <p className="mt-10 text-[11px] text-white/20 font-mono tracking-wider">
              FBC 8th Edition · ASCE 7-22 · RAS 117 · TAS 105-20 · NOAA Atlas 14
            </p>
          </div>

          {/* Right — Floating card (hidden on mobile) */}
          <div className="hidden lg:flex flex-1 justify-center">
            <FloatingCalcCard />
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <StatsBar />

      {/* How It Works */}
      <section className="relative px-6 py-16 md:py-24">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <div className="relative mx-auto max-w-4xl">
          <AnimatedSection>
            <h2 className="text-center text-2xl font-bold text-primary mb-14">
              How It Works
            </h2>
          </AnimatedSection>

          <div className="grid gap-8 md:grid-cols-3 relative">
            {/* Dashed connectors */}
            <div className="hidden md:block absolute top-8 left-[calc(33.33%)] right-[calc(33.33%)] h-0 border-t-2 border-dashed border-hvhz-teal/20" />

            {howItWorks.map((item, i) => (
              <AnimatedSection key={item.step} delay={i * 100}>
                <div className="flex flex-col items-center text-center rounded-2xl border bg-card p-8 shadow-elevated hover:-translate-y-1 hover:shadow-elevated-hover transition-all duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hvhz-teal text-white font-bold text-lg mb-5">
                    {item.step}
                  </div>
                  <h3 className="text-sm font-semibold text-primary mb-2">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="px-6 py-16 md:py-24 bg-card">
        <div className="mx-auto max-w-5xl">
          <AnimatedSection>
            <h2 className="text-2xl font-bold text-primary">
              Engineering Services
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Florida Building Code compliant testing and certification
            </p>
          </AnimatedSection>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => {
              const { ref, isInView } = useInView();
              return (
                <div
                  key={service.name}
                  ref={ref}
                  className={cn(
                    "group relative rounded-xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-elevated-hover hover:-translate-y-1 hover:border-hvhz-teal/30",
                    isInView ? "animate-in" : "opacity-0"
                  )}
                  style={{ animationDelay: `${(i % 3) * 80}ms` }}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-hvhz-teal/10 text-hvhz-teal transition-all duration-300 group-hover:scale-110 group-hover:glow-teal">
                        <service.icon className="h-5 w-5" />
                      </div>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-primary">
                        {service.price}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-primary leading-snug">
                      {service.name}
                    </h3>
                    {service.code && (
                      <span className="mt-1.5 inline-block text-[10px] font-mono tracking-wide text-hvhz-teal/70 bg-hvhz-teal/5 px-2 py-0.5 rounded">
                        {service.code}
                      </span>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {service.description}
                    </p>
                  </div>
                  {/* Bottom accent bar */}
                  <div className="h-[3px] bg-gradient-to-r from-transparent via-hvhz-teal to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why HVHZ Engineering */}
      <section className="px-6 py-16 md:py-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="mx-auto max-w-5xl grid gap-12 md:grid-cols-5">
          {/* Left */}
          <AnimatedSection className="md:col-span-2">
            <h2 className="text-2xl font-bold text-primary leading-tight">
              Built for Hurricane Country
            </h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              The only AI-powered engineering firm dedicated to South Florida's
              High Velocity Hurricane Zone. We combine automated calculations with
              licensed PE oversight to deliver permit-ready reports faster than anyone.
            </p>
            <div className="mt-8 flex gap-3">
              {["FL PE", "FBC", "HVHZ"].map((badge) => (
                <div
                  key={badge}
                  className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-hvhz-teal/20 bg-hvhz-teal/5"
                >
                  <span className="text-[10px] font-mono font-bold text-hvhz-teal">{badge}</span>
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* Right — 2x2 grid */}
          <div className="md:col-span-3 grid gap-4 sm:grid-cols-2">
            {trustSignals.map((signal, i) => (
              <AnimatedSection key={signal.title} delay={i * 80}>
                <div className="rounded-xl border bg-card p-6 flex items-start gap-4 hover:-translate-y-0.5 hover:shadow-elevated-hover transition-all duration-300 h-full">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hvhz-teal/10 text-hvhz-teal transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_hsl(174_84%_32%/0.15)]">
                    <signal.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary">{signal.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{signal.description}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 sm:grid-cols-3">
            <div>
              <BrandMark size="md" subtitle="Engineering" variant="light" />
              <p className="mt-4 text-xs text-primary-foreground/40 leading-relaxed">
                750 E Sample Rd<br />
                Pompano Beach, FL 33064
              </p>
            </div>
            <div>
              <h4 className="text-label-upper text-primary-foreground/30 mb-4">Services</h4>
              <ul className="space-y-2 text-xs text-primary-foreground/50">
                <li className="hover:text-hvhz-teal transition-colors cursor-default">Fastener Calculations</li>
                <li className="hover:text-hvhz-teal transition-colors cursor-default">Drainage Analysis</li>
                <li className="hover:text-hvhz-teal transition-colors cursor-default">Wind Mitigation</li>
                <li className="hover:text-hvhz-teal transition-colors cursor-default">TAS Testing</li>
                <li className="hover:text-hvhz-teal transition-colors cursor-default">Roof Inspections</li>
              </ul>
            </div>
            <div>
              <h4 className="text-label-upper text-primary-foreground/30 mb-4">Company</h4>
              <ul className="space-y-2 text-xs text-primary-foreground/50">
                <li><Link to="/auth" className="hover:text-hvhz-teal transition-colors">Client Portal</Link></li>
                <li><Link to="/auth" className="hover:text-hvhz-teal transition-colors">Sign In</Link></li>
                <li><Link to="/order" className="hover:text-hvhz-teal transition-colors">Order Services</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-primary-foreground/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-primary-foreground/25 font-mono">
              © 2026 HVHZ Engineering LLC · FL PE Licensed
            </p>
            <p className="text-[10px] text-primary-foreground/15 font-mono tracking-wider">
              FBC 8th Edition · ASCE 7-22 · RAS 117 · TAS 105-20
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
