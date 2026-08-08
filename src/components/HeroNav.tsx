import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Services", href: "#services" },
  { label: "How it works", href: "#process" },
  { label: "For contractors", href: "#contractors" },
  { label: "Contact", href: "#contact" },
];

export function HeroNav({ solid = false }: { solid?: boolean }) {
  const [atTop, setAtTop] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  // On pages without a dark hero behind the nav, force the solid style.
  const scrolled = solid || !atTop;

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY <= 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/85 backdrop-blur-lg border-b shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
        <Link to="/" aria-label="HVHZ Engineering home">
          <BrandMark size="sm" variant={scrolled ? "dark" : "light"} />
        </Link>

        {/* Center links — desktop */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                scrolled
                  ? "text-muted-foreground hover:text-primary hover:bg-muted"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right actions — desktop */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "transition-colors",
              scrolled ? "text-muted-foreground hover:text-primary" : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            asChild
          >
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button
            size="sm"
            className="bg-hvhz-teal text-white hover:bg-hvhz-teal/90 active:scale-[0.97] transition-all shadow-lg shadow-hvhz-teal/25"
            asChild
          >
            <Link to="/order">
              Start an order <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className={cn("md:hidden p-2 rounded-md transition-colors", scrolled ? "text-primary" : "text-white")}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-lg border-b px-6 py-4 space-y-1 reveal">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-primary rounded-md hover:bg-muted transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 space-y-2 border-t mt-2">
            <Button variant="outline" className="w-full" asChild>
              <Link to="/auth" onClick={() => setMobileOpen(false)}>Sign in</Link>
            </Button>
            <Button className="w-full bg-hvhz-teal text-white hover:bg-hvhz-teal/90" asChild>
              <Link to="/order" onClick={() => setMobileOpen(false)}>
                Start an order <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
