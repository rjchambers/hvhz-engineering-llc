import { PortalLayout } from "@/components/PortalLayout";

export default function MyProfile() {
  return (
    <PortalLayout>
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-primary">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your company information and account settings.</p>
        <div className="mt-8 rounded-lg border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Profile management coming soon.</p>
        </div>
      </div>
    </PortalLayout>
  );
}
