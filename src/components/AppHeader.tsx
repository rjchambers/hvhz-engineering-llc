import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-hvhz-teal">
            <span className="text-xs font-bold text-white">HZ</span>
          </div>
          <span className="text-sm font-semibold text-primary">
            HVHZ Engineering
          </span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]">
            JD
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="gap-2 cursor-pointer">
            <User className="h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
