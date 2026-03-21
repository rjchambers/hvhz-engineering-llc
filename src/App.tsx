import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NewOrder from "./pages/portal/NewOrder";
import OrderConfirmed from "./pages/portal/OrderConfirmed";
import Dashboard from "./pages/portal/Dashboard";
import MyProfile from "./pages/portal/MyProfile";
import Pipeline from "./pages/admin/Pipeline";
import WorkOrders from "./pages/admin/WorkOrders";
import AdminUsers from "./pages/admin/Users";
import AdminAnalytics from "./pages/admin/Analytics";
import TechDashboard from "./pages/tech/TechDashboard";
import TechWorkOrderDetail from "./pages/tech/TechWorkOrderDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/portal/new-order" element={<NewOrder />} />
          <Route path="/portal/order-confirmed" element={<OrderConfirmed />} />
          <Route path="/portal/dashboard" element={<Dashboard />} />
          <Route path="/portal/orders" element={<Dashboard />} />
          <Route path="/portal/profile" element={<MyProfile />} />
          <Route path="/admin" element={<Pipeline />} />
          <Route path="/admin/work-orders" element={<WorkOrders />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/tech" element={<TechDashboard />} />
          <Route path="/tech/work-order/:id" element={<TechWorkOrderDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
