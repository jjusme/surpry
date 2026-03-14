import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingState } from "../components/feedback/LoadingState";
import { useAuth } from "../features/auth/AuthContext";

export function ProtectedRoute() {
  const location = useLocation();
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState message="Preparando tu sesion..." fullScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const hasCompletedSetup = localStorage.getItem("has_completed_setup") === "true";

  if (!hasCompletedSetup && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState message="Cargando..." fullScreen />;
  }

  if (session) {
    return <Navigate to="/inicio" replace />;
  }

  return <Outlet />;
}
