import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../features/auth/AuthContext";
import { getUnreadNotifications } from "../../features/home/service";

export function NotificationBell() {
  const navigate = useNavigate();
  const { user, isSupabaseConfigured } = useAuth();

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => getUnreadNotifications(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured),
    staleTime: 0,
    refetchInterval: 30_000
  });

  const unreadCount = data?.length || 0;

  return (
    <button
      aria-label="Notificaciones"
      className="relative flex size-11 items-center justify-center rounded-2xl bg-surface shadow-card"
      onClick={() => navigate("/notificaciones")}
    >
      <span className="material-symbols-outlined text-[1.4rem] text-text-muted">
        notifications
      </span>
      {unreadCount > 0 && (
        <span className="absolute right-2 top-2 size-2.5 rounded-full bg-primary">
          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
        </span>
      )}
    </button>
  );
}
