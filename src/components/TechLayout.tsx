import { SidebarProvider } from "@/components/ui/sidebar";
import { TechSidebar } from "@/components/TechSidebar";
import { AppHeader } from "@/components/AppHeader";

interface TechLayoutProps {
  children: React.ReactNode;
}

export function TechLayout({ children }: TechLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <TechSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
