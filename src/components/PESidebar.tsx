import { FileSearch, User, ArrowLeft } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserRoles } from "@/lib/authz";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const peItems = [
  { title: "Review Queue", url: "/pe", icon: FileSearch },
  { title: "My Profile & Credentials", url: "/pe/profile", icon: User },
];

export function PESidebar() {
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
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-hvhz-teal">
              <span className="text-sm font-bold text-white">HZ</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-sidebar-foreground">HVHZ</p>
              <p className="text-[11px] text-sidebar-foreground/60">PE Portal</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-hvhz-teal">
              <span className="text-sm font-bold text-white">HZ</span>
            </div>
          </div>
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
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[11px] uppercase tracking-wider">Engineer</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {peItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-hvhz-teal font-medium">
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
        {!collapsed && <p className="text-[11px] text-sidebar-foreground/40 text-center">© 2026 HVHZ Engineering</p>}
      </SidebarFooter>
    </Sidebar>
  );
}
