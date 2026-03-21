import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Shield, Wrench, FileCheck, Users } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-hvhz-navy/10">
          <span className="text-4xl font-bold text-hvhz-navy">404</span>
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">Page Not Found</h1>
        <p className="text-sm text-muted-foreground mb-8">
          The page <code className="text-xs bg-muted-foreground/10 px-1.5 py-0.5 rounded">{location.pathname}</code> doesn't exist or you don't have access.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/"><Home className="h-4 w-4" /> Home</Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/portal/dashboard"><Users className="h-4 w-4" /> Client Portal</Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/tech"><Wrench className="h-4 w-4" /> Tech Portal</Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/pe"><FileCheck className="h-4 w-4" /> PE Portal</Link>
          </Button>
        </div>

        <Button asChild className="mt-4 w-full bg-hvhz-navy hover:bg-hvhz-navy/90 gap-2">
          <Link to="/admin"><Shield className="h-4 w-4" /> Admin Panel</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
