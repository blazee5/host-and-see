import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Explore from "./pages/Explore";
import EventDetail from "./pages/EventDetail";
import HostPublic from "./pages/HostPublic";
import HostOnboarding from "./pages/HostOnboarding";
import HostDashboard from "./pages/HostDashboard";
import EventEditor from "./pages/EventEditor";
import MyTickets from "./pages/MyTickets";
import MyEvents from "./pages/MyEvents";
import CheckIn from "./pages/CheckIn";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/h/:slug" element={<HostPublic />} />
            <Route path="/host/onboarding" element={<HostOnboarding />} />
            <Route path="/host/dashboard" element={<HostDashboard />} />
            <Route path="/host/events/new" element={<EventEditor />} />
            <Route path="/host/events/:id/edit" element={<EventEditor />} />
            <Route path="/host/checkin/:eventId" element={<CheckIn />} />
            <Route path="/me/tickets" element={<MyTickets />} />
            <Route path="/me/events" element={<MyEvents />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
