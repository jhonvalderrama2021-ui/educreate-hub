import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteFallback } from "@/components/RouteFallback";
import { useAuth } from "@/hooks/useAuth";
import { useRegistroAcceso } from "@/hooks/useRegistroAcceso";

// Rutas cargadas de forma diferida: cada una viaja en su propio chunk y
// solo se descarga cuando el usuario la visita.
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Resources = lazy(() => import("./pages/Resources"));
const Privacidad = lazy(() => import("./pages/Privacidad"));
const MisDatos = lazy(() => import("./pages/MisDatos"));
const RestablecerClave = lazy(() => import("./pages/RestablecerClave"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

/**
 * Va dentro del router porque el latido de acceso solo tiene sentido con la
 * sesion ya resuelta.
 */
const Contenido = () => {
  const { user } = useAuth();
  useRegistroAcceso(!!user);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/resources/*" element={<Resources />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/mis-datos" element={<MisDatos />} />
        <Route path="/restablecer" element={<RestablecerClave />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Contenido />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
