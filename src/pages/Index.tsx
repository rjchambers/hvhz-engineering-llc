import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { getDefaultRouteForRoles, getUserRoles } from "@/lib/authz";
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
    <AppLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary px-6 py-16 md:py-24">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl md:text-5xl" style={{ lineHeight: '1.1' }}>
            HVHZ Engineering
          </h1>
          <p className="mt-3 text-lg font-medium text-hvhz-teal sm:text-xl">
            Engineered for the Storm Belt
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm text-primary-foreground/70 sm:text-base" style={{ textWrap: 'balance' }}>
            Comprehensive roof engineering for South Florida's most demanding codes.
          </p>
          <Button
            size="lg"
            className="mt-8 bg-hvhz-teal text-white hover:bg-hvhz-teal/90 active:scale-[0.97] transition-all shadow-lg shadow-hvhz-teal/20"
          >
            Order Services
          </Button>
        </div>
      </section>

      {/* Services Grid */}
      <section className="px-6 py-12 md:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl font-bold text-primary sm:text-2xl">
            Engineering Services
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Florida Building Code compliant testing and certification
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {services.map((service, i) => (
              <div
                key={service.name}
                className="group relative flex items-start gap-4 rounded-lg border-l-[3px] border-l-hvhz-teal bg-card p-4 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-hvhz-teal">
                  <service.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-primary leading-snug">
                      {service.name}
                    </h3>
                    <span className="shrink-0 rounded bg-primary/5 px-2 py-0.5 text-sm font-bold tabular-nums text-primary">
                      {service.price}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card px-6 py-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-medium text-primary">HVHZ Engineering</p>
          <p className="mt-1 text-xs text-muted-foreground">
            750 E Sample Rd, Pompano Beach FL 33064
          </p>
        </div>
      </footer>
    </AppLayout>
  );
};

export default Index;
