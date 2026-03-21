import { Kanban, List, Users, BarChart3, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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

const adminItems = [
  { title: "Order Pipeline", url: "/admin", icon: Kanban },
  { title: "Work Orders", url: "/admin/work-orders", icon: List },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-hvhz-teal">
              <span className="text-sm font-bold text-white">HZ</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-sidebar-foreground">HVHZ</p>
              <p className="text-[11px] text-sidebar-foreground/60">Admin Portal</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-hvhz-teal">
              <span className="text-sm font-bold text-white">HZ</span>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[11px] uppercase tracking-wider">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.url === "/admin"
                        ? location.pathname === "/admin"
                        : location.pathname.startsWith(item.url)
                    }
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-hvhz-teal font-medium"
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
          <p className="text-[11px] text-sidebar-foreground/40 text-center">
            © 2026 HVHZ Engineering
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
