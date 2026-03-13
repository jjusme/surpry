import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useAuth } from "../../auth/AuthContext";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../service";
import { requireSupabase } from "../../../lib/supabase";
import { cn } from "../../../utils/cn";
import { useEffect } from "react";

export function NotificationsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user, isSupabaseConfigured } = useAuth();

    const notificationsQuery = useQuery({
        queryKey: ["notifications", "all", user?.id],
        queryFn: () => listNotifications(user.id),
        enabled: Boolean(user?.id && isSupabaseConfigured)
    });

    useEffect(() => {
        if (!user?.id || !isSupabaseConfigured) return;

        const supabase = requireSupabase();
        const channel = supabase
            .channel("notifications_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["notifications"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, isSupabaseConfigured, queryClient]);

    const markReadMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    const markAllReadMutation = useMutation({
        mutationFn: () => markAllNotificationsRead(user.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    const handleNotificationClick = async (notification) => {
        if (!notification.read_at) {
            markReadMutation.mutate(notification.id);
        }

        // Navigate based on type or metadata
        const meta = notification.metadata || {};
        if (meta.event_id) {
            navigate(`/eventos/${meta.event_id}`);
        } else if (meta.group_id) {
            navigate(`/grupos/${meta.group_id}`);
        } else if (meta.share_id) {
            navigate(`/shares/${meta.share_id}`);
        }
    };

    if (notificationsQuery.isLoading) {
        return <LoadingState message="Cargando notificaciones..." fullScreen />;
    }

    if (notificationsQuery.error) {
        return (
            <div className="app-frame flex items-center px-4">
                <ErrorState
                    title="No pudimos cargar tus notificaciones"
                    description={notificationsQuery.error.message}
                    onRetry={notificationsQuery.refetch}
                />
            </div>
        );
    }

    const notifications = notificationsQuery.data || [];
    const unreadCount = notifications.filter((n) => !n.read_at).length;

    return (
        <AppShell
            activeTab="inicio"
            header={
                <PageHeader
                    title="Notificaciones"
                    backTo="/inicio"
                    action={
                        unreadCount > 0 ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs font-bold text-primary"
                                onClick={() => markAllReadMutation.mutate()}
                                disabled={markAllReadMutation.isPending}
                            >
                                {markAllReadMutation.isPending ? "Marcando..." : "Marcar todas"}
                            </Button>
                        ) : null
                    }
                />
            }
        >
            <div className="space-y-4 pt-4">
                {notifications.length === 0 ? (
                    <EmptyState
                        icon="notifications_off"
                        title="Nada por aquí"
                        description="Aún no tienes notificaciones. Te avisaremos cuando haya novedades en tus grupos."
                    />
                ) : (
                    <div className="space-y-2">
                        {notifications.map((notification) => {
                            const Icon = (() => {
                                switch (notification.type) {
                                    case 'expense_created': return 'receipt_long';
                                    case 'payment_reported': return 'payments';
                                    case 'payment_confirmed': return 'task_alt';
                                    case 'event_created': return 'celebration';
                                    case 'gift_proposed': return 'card_giftcard';
                                    default: return 'notifications';
                                }
                            })();

                            const isUnread = !notification.read_at;

                            return (
                                <Card
                                    key={notification.id}
                                    className={cn(
                                        "cursor-pointer transition-all active:scale-95 hover:border-primary/20",
                                        isUnread ? "bg-surface border-primary/20 shadow-sm" : "bg-surface-muted/50 border-transparent opacity-80"
                                    )}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex gap-4">
                                        <div className={cn(
                                            "flex size-10 flex-shrink-0 items-center justify-center rounded-2xl transition-colors",
                                            isUnread ? "bg-primary/20 text-primary" : "bg-bg text-text-muted"
                                        )}>
                                            <span className="material-symbols-outlined text-[1.25rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                {Icon}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-0.5">
                                                <p className={cn("text-sm font-bold truncate", isUnread ? "text-text" : "text-text-muted")}>
                                                    {notification.title}
                                                </p>
                                                <span className="text-[10px] font-bold text-text-muted/60 flex-shrink-0 whitespace-nowrap mt-0.5">
                                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
                                                </span>
                                            </div>
                                            {notification.message && (
                                                <p className={cn("text-xs leading-relaxed line-clamp-2", isUnread ? "text-text-muted" : "text-text-muted/60")}>
                                                    {notification.message}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
