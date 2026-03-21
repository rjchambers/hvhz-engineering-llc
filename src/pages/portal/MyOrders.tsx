import { PortalLayout } from "@/components/PortalLayout";

export default function MyOrders() {
  return (
    <PortalLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-primary">My Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your order history will appear here.</p>
        <div className="mt-8 rounded-lg border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No orders yet. Place your first order to get started.</p>
        </div>
      </div>
    </PortalLayout>
  );
}
