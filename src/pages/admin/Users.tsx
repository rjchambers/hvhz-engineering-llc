import { AdminLayout } from "@/components/AdminLayout";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search } from "lucide-react";

const ROLES = ["admin", "client", "technician", "engineer"] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  client: "bg-blue-100 text-blue-700",
  technician: "bg-teal-100 text-teal-700",
  engineer: "bg-amber-100 text-amber-700",
};

interface UserRow {
  user_id: string;
  role: string;
  created_at: string;
  displayName: string;
  email: string;
  company: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");

  const fetchUsers = useCallback(async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role, created_at").order("created_at", { ascending: false });
    if (!roles) return;

    const uids = [...new Set(roles.map((r) => r.user_id))];

    // Fetch client_profiles for clients/techs
    const { data: clientProfiles } = await supabase.from("client_profiles").select("user_id, contact_name, contact_email, company_name").in("user_id", uids);
    const clientMap = new Map((clientProfiles ?? []).map((p) => [p.user_id, p]));

    // Fetch engineer_profiles for engineers
    const { data: engProfiles } = await supabase.from("engineer_profiles").select("user_id, full_name").in("user_id", uids);
    const engMap = new Map((engProfiles ?? []).map((p) => [p.user_id, p]));

    setUsers(roles.map((r) => {
      const cp = clientMap.get(r.user_id);
      const ep = engMap.get(r.user_id);

      let displayName = r.user_id.slice(0, 8);
      if (r.role === "engineer" && ep?.full_name) displayName = ep.full_name;
      else if (cp?.contact_name) displayName = cp.contact_name;

      return {
        user_id: r.user_id,
        role: r.role,
        created_at: r.created_at,
        displayName,
        email: cp?.contact_email ?? "—",
        company: cp?.company_name ?? "—",
      };
    }));
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const changeRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);
    if (error) toast.error("Failed to update role");
    else { toast.success(`Role updated to ${newRole}`); fetchUsers(); }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.company.toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Users</h1>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Change Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={`${u.user_id}-${u.role}`}>
                  <TableCell className="text-sm font-medium">{u.displayName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-sm">{u.company}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-700"}>{u.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(u.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => changeRole(u.user_id, v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
