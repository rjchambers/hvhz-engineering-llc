import { ClipboardList, ArrowLeft } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserRoles } from "@/lib/authz";
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

const techItems = [
  { title: "My Work Orders", url: "/tech", icon: ClipboardList },
];

export function TechSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setIsAdmin(false);
      return;
    }

    getUserRoles(user.id)
      .then((roles) => {
        if (!cancelled) setIsAdmin(roles.has("admin"));
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        {!collapsed ? (
          <BrandMark size="md" subtitle="Field Tech" />
        ) : (
          <BrandMark size="md" showText={false} />
        )}
      </SidebarHeader>

      <SidebarContent>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin" className="hover:bg-sidebar-accent text-muted-foreground">
                      <ArrowLeft className="h-4 w-4" />
                      {!collapsed && <span>Back to Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[11px] uppercase tracking-wider">
            Technician
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {techItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
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
