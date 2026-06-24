import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "../components/feedback/LoadingState";
import { useAuth } from "../features/auth/AuthContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export function ProtectedRoute() {
  const location = useLocation();
  const { session, isLoading: authLoading } = useAuth();

  const profileQuery = useQuery({
    queryKey: ["profile-setup-check", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id || !isSupabaseConfigured) return null;
      const { data } = await supabase
        .from("profiles")
        .select("has_completed_setup, birthday_day, birthday_month")
        .eq("id", session.user.id)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(session?.user?.id && isSupabaseConfigured),
    staleTime: 60000
  });

  if (authLoading) {
    return <LoadingState message="Preparando tu sesion..." fullScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const hasCompletedSetup = profileQuery.data?.has_completed_setup === true;
  const hasBirthday = profileQuery.data?.birthday_day && profileQuery.data?.birthday_month;

  if (profileQuery.isLoading) {
    return <LoadingState message="Cargando tu perfil..." fullScreen />;
  }

  if ((!hasCompletedSetup || !hasBirthday) && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }

  const pendingInviteRaw = localStorage.getItem("pending_invite_token");
  let pendingInvite = null;
  if (pendingInviteRaw) {
    try {
      const parsed = JSON.parse(pendingInviteRaw);
      const age = Date.now() - parsed.ts;
      if (age < 24 * 60 * 60 * 1000) {
        pendingInvite = parsed.token;
      } else {
        localStorage.removeItem("pending_invite_token");
      }
    } catch {
      pendingInvite = pendingInviteRaw;
      localStorage.removeItem("pending_invite_token");
    }
  }
  if (pendingInvite && location.pathname === "/inicio") {
    return <Navigate to={`/join/${pendingInvite}`} replace />;
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
