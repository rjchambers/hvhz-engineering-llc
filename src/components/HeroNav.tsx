import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function HeroNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-lg border-b shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
        <Link to="/">
          <BrandMark size="md" variant={scrolled ? "dark" : "light"} />
        </Link>

        {/* Desktop */}
        <div className="hidden sm:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "transition-colors",
              scrolled ? "text-muted-foreground hover:text-primary" : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            asChild
          >
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button
            size="sm"
            className="bg-hvhz-teal text-white hover:bg-hvhz-teal/90 active:scale-[0.97] transition-all shadow-lg shadow-hvhz-teal/20"
            asChild
          >
            <Link to="/order">
              Order Services <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className={cn("sm:hidden p-2 rounded-md transition-colors", scrolled ? "text-primary" : "text-white")}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden bg-background/95 backdrop-blur-lg border-b px-6 py-4 space-y-3 animate-in">
          <Button variant="ghost" className="w-full justify-start" asChild>
            <Link to="/auth" onClick={() => setMobileOpen(false)}>Sign In</Link>
          </Button>
          <Button className="w-full bg-hvhz-teal text-white" asChild>
            <Link to="/order" onClick={() => setMobileOpen(false)}>
              Order Services <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </nav>
  );
}
