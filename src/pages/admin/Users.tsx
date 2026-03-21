import { AdminLayout } from "@/components/AdminLayout";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  profile?: { contact_name: string | null; contact_email: string | null; company_name: string | null } | null;
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);

  const fetchUsers = useCallback(async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role, created_at").order("created_at", { ascending: false });
    if (!roles) return;

    const uids = [...new Set(roles.map((r) => r.user_id))];
    const { data: profiles } = await supabase.from("client_profiles").select("user_id, contact_name, contact_email, company_name").in("user_id", uids);
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

    setUsers(roles.map((r) => ({ ...r, profile: profileMap.get(r.user_id) })));
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

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Users</h1>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Change Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={`${u.user_id}-${u.role}`}>
                  <TableCell className="text-sm font-medium">{u.profile?.contact_name ?? u.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.profile?.contact_email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{u.profile?.company_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-700"}>{u.role}</Badge>
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
              {users.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
