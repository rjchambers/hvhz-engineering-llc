import { PlusCircle, LayoutDashboard, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const portalItems = [
  { title: "New Order", url: "/portal/new-order", icon: PlusCircle },
  { title: "My Orders", url: "/portal/dashboard", icon: LayoutDashboard },
  { title: "My Profile", url: "/portal/profile", icon: User },
];

export function PortalSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        {!collapsed ? (
          <BrandMark size="md" variant="light" subtitle="Client Portal" />
        ) : (
          <BrandMark size="sm" variant="light" />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[11px] uppercase tracking-wider">
            Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {portalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-hvhz-teal font-medium border-l-2 border-l-hvhz-teal -ml-[2px]"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="text-center space-y-0.5">
            <p className="text-[11px] text-sidebar-foreground/40">© 2026 HVHZ Engineering</p>
            <p className="text-[9px] text-sidebar-foreground/25 font-mono">AI-Powered · FBC 8th Ed.</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
