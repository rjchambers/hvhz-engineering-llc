import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanStaleDrafts } from "@/lib/draft-cleanup";

// Run once on app load
cleanStaleDrafts();
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import AdminSettings from "./pages/admin/Settings";
import TechDashboard from "./pages/tech/TechDashboard";
import TechWorkOrderDetail from "./pages/tech/TechWorkOrderDetail";
import PEReviewQueue from "./pages/pe/PEReviewQueue";
import PEReviewDetail from "./pages/pe/PEReviewDetail";
import WindMitigationCalc from "./pages/pe/WindMitigationCalc";
import FastenerCalc from "./pages/pe/FastenerCalc";
import DrainageCalc from "./pages/pe/DrainageCalc";
import PEProfile from "./pages/pe/PEProfile";
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
          <Route path="/portal/new-order" element={<ProtectedRoute requiredRole="client"><NewOrder /></ProtectedRoute>} />
          <Route path="/portal/order-confirmed" element={<ProtectedRoute requiredRole="client"><OrderConfirmed /></ProtectedRoute>} />
          <Route path="/portal/dashboard" element={<ProtectedRoute requiredRole="client"><Dashboard /></ProtectedRoute>} />
          <Route path="/portal/orders" element={<ProtectedRoute requiredRole="client"><Dashboard /></ProtectedRoute>} />
          <Route path="/portal/profile" element={<ProtectedRoute requiredRole="client"><MyProfile /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><Pipeline /></ProtectedRoute>} />
          <Route path="/admin/work-orders" element={<ProtectedRoute requiredRole="admin"><WorkOrders /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="admin"><AdminAnalytics /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><AdminSettings /></ProtectedRoute>} />
          <Route path="/tech" element={<ProtectedRoute requiredRole="technician"><TechDashboard /></ProtectedRoute>} />
          <Route path="/tech/work-order/:id" element={<ProtectedRoute requiredRole="technician"><TechWorkOrderDetail /></ProtectedRoute>} />
          <Route path="/pe" element={<ProtectedRoute requiredRole="engineer"><PEReviewQueue /></ProtectedRoute>} />
          <Route path="/pe/review/:id" element={<ProtectedRoute requiredRole="engineer"><PEReviewDetail /></ProtectedRoute>} />
          <Route path="/pe/calculations/wind-mitigation/:id" element={<ProtectedRoute requiredRole="engineer"><WindMitigationCalc /></ProtectedRoute>} />
          <Route path="/pe/calculations/fastener/:id" element={<ProtectedRoute requiredRole="engineer"><FastenerCalc /></ProtectedRoute>} />
          <Route path="/pe/calculations/drainage-analysis/:id" element={<ProtectedRoute requiredRole="engineer"><DrainageCalc /></ProtectedRoute>} />
          <Route path="/pe/profile" element={<ProtectedRoute requiredRole="engineer"><PEProfile /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
