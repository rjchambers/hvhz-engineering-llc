import { SidebarProvider } from "@/components/ui/sidebar";
import { PESidebar } from "@/components/PESidebar";
import { AppHeader } from "@/components/AppHeader";

interface PELayoutProps { children: React.ReactNode; }

export function PELayout({ children }: PELayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PESidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
