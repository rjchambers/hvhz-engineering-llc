import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultRouteForRoles, getUserRoles } from "@/lib/authz";
import { BrandMark } from "@/components/BrandMark";
import {
  Crosshair,
  Layers,
  TestTube2,
  Droplets,
  Search,
  ShieldCheck,
  CloudRain,
  HardHat,
  Wind,
  ArrowUpFromLine,
  Shield,
  Zap,
  Clock,
  FileCode2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  { name: "TAS-105 Fastener Withdrawal Test", price: "$450", icon: Crosshair, description: "Standard fastener withdrawal testing per TAS-105 protocol" },
  { name: "TAS-106 Tile Bonding Verification", price: "$450", icon: Layers, description: "Tile adhesion and bonding strength verification" },
  { name: "TAS-124 Bonded Pull Test", price: "$450", icon: TestTube2, description: "Bonded pull testing for roof system compliance" },
  { name: "TAS-126 Moisture Survey", price: "$450", icon: Droplets, description: "Infrared moisture survey and analysis" },
  { name: "Roof Inspection", price: "$350", icon: Search, description: "Comprehensive visual and structural roof inspection" },
  { name: "Roof Certification", price: "$450", icon: ShieldCheck, description: "Full roof certification for code compliance" },
  { name: "Drainage Analysis", price: "$550", icon: CloudRain, description: "Roof drainage capacity and slope analysis" },
  { name: "Special Inspection", price: "$400", icon: HardHat, description: "Threshold and special inspector services" },
  { name: "Wind Mitigation (Roofing Permit)", price: "$500", icon: Wind, description: "Wind mitigation report for permitting" },
  { name: "Fastener Uplift Calculation", price: "$350", icon: ArrowUpFromLine, description: "Engineering calculations for fastener uplift resistance" },
];

const trustSignals = [
  { icon: Shield, title: "FL PE Licensed", description: "Every report signed and sealed by a licensed Florida Professional Engineer" },
  { icon: Zap, title: "AI-Powered Calculations", description: "Automated engineering calculations with human PE oversight and verification" },
  { icon: Clock, title: "Same-Day Delivery", description: "Most reports delivered within 24 hours of field inspection completion" },
  { icon: FileCode2, title: "Code-First Approach", description: "Built on FBC 8th Edition, ASCE 7-22, and all applicable Florida standards" },
];

const howItWorks = [
  { step: 1, title: "Order Online", description: "Select your services, enter job site details, and check out securely." },
  { step: 2, title: "We Inspect & Calculate", description: "A certified technician performs field work while our AI engine runs the numbers." },
  { step: 3, title: "Signed Report Delivered", description: "A licensed PE reviews, signs, and seals your permit-ready report." },
];

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

    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary px-6 py-20 md:py-28">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(13,148,136,0.06) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="flex justify-center mb-8">
            <BrandMark size="lg" subtitle="Engineering" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl text-display text-white" style={{ lineHeight: '1.05' }}>
            AI-Powered Roof Engineering for South Florida
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60" style={{ textWrap: 'balance' }}>
            Permit-ready calculations. Signed and sealed by licensed Florida PEs. Delivered in hours, not weeks.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-hvhz-teal text-white hover:bg-hvhz-teal/90 active:scale-[0.97] transition-all shadow-lg shadow-hvhz-teal/20"
              asChild
            >
              <Link to="/auth">
                Order Services <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              asChild
            >
              <Link to="/auth">Sign In</Link>
            </Button>
          </div>
          <p className="mt-10 text-xs text-white/30 font-mono tracking-wide">
            FBC 8th Edition · ASCE 7-22 · RAS 117 · TAS 105
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-xl font-bold text-primary sm:text-2xl mb-12">
            How It Works
          </h2>
          <div className="grid gap-8 md:grid-cols-3 relative">
            {/* Dashed connectors (desktop only) */}
            <div className="hidden md:block absolute top-5 left-[calc(33.33%+20px)] right-[calc(33.33%+20px)] h-0 border-t-2 border-dashed border-border" style={{ width: 'calc(33.33% - 40px)', left: 'calc(16.67% + 20px)' }} />
            <div className="hidden md:block absolute top-5 border-t-2 border-dashed border-border" style={{ width: 'calc(33.33% - 40px)', left: 'calc(50% + 20px)' }} />
            {howItWorks.map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-hvhz-teal text-white font-bold text-sm mb-4">
                  {item.step}
                </div>
                <h3 className="text-sm font-semibold text-primary mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="px-6 py-12 md:py-16 bg-card">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl font-bold text-primary sm:text-2xl">
            Engineering Services
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Florida Building Code compliant testing and certification
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => (
              <div
                key={service.name}
                className="group relative rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-lg hover:border-hvhz-teal/30 hover:-translate-y-0.5 active:scale-[0.99]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-hvhz-teal/10 text-hvhz-teal">
                    <service.icon className="h-4 w-4" />
                  </div>
                  <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-primary">
                    {service.price}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-primary leading-snug">
                  {service.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="px-6 py-16 md:py-20 bg-muted/50">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-xl font-bold text-primary sm:text-2xl mb-10">
            Why HVHZ Engineering
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {trustSignals.map((signal) => (
              <div key={signal.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-hvhz-teal/10 text-hvhz-teal">
                  <signal.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary">{signal.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{signal.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <BrandMark size="md" subtitle="Engineering" />
              <p className="mt-3 text-xs text-primary-foreground/50 leading-relaxed">
                750 E Sample Rd<br />
                Pompano Beach, FL 33064
              </p>
            </div>
            <div>
              <h4 className="text-label-upper text-primary-foreground/40 mb-3">Services</h4>
              <ul className="space-y-1.5 text-xs text-primary-foreground/60">
                <li>Fastener Calculations</li>
                <li>Drainage Analysis</li>
                <li>Wind Mitigation</li>
                <li>TAS Testing</li>
                <li>Roof Inspections</li>
              </ul>
            </div>
            <div>
              <h4 className="text-label-upper text-primary-foreground/40 mb-3">Company</h4>
              <ul className="space-y-1.5 text-xs text-primary-foreground/60">
                <li><Link to="/auth" className="hover:text-primary-foreground transition-colors">Client Portal</Link></li>
                <li><Link to="/auth" className="hover:text-primary-foreground transition-colors">Sign In</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-primary-foreground/10 text-center">
            <p className="text-[11px] text-primary-foreground/30 font-mono">
              © 2026 HVHZ Engineering LLC · FL PE Licensed · FBC 8th Edition
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
