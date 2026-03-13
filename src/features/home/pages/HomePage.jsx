import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { useAuth } from "../../auth/AuthContext";
import { listGroups } from "../../groups/service";
import { listEvents } from "../../events/service";
import { requireSupabase } from "../../../lib/supabase";
import { formatDate } from "../../../utils/format";

async function getPendingShares(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("expense_shares")
    .select(`
      *,
      expenses (
        id,
        title,
        amount,
        event_id
      )
    `)
    .eq("user_id", userId)
    .in("status", ["pending", "rejected", "reported_paid"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function getNotifications(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const groupsQuery = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: () => listGroups(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const eventsQuery = useQuery({
    queryKey: ["events", user?.id],
    queryFn: () => listEvents(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const sharesQuery = useQuery({
    queryKey: ["pending-shares", user?.id],
    queryFn: () => getPendingShares(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => getNotifications(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    }
  });

  if (groupsQuery.isLoading || eventsQuery.isLoading || sharesQuery.isLoading || notificationsQuery.isLoading) {
    return <LoadingState message="Cargando tu tablero..." fullScreen />;
  }

  if (groupsQuery.error || eventsQuery.error || sharesQuery.error || notificationsQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tu inicio"
          description={groupsQuery.error?.message || eventsQuery.error?.message || sharesQuery.error?.message || notificationsQuery.error?.message}
          onRetry={() => {
            groupsQuery.refetch();
            eventsQuery.refetch();
            sharesQuery.refetch();
            notificationsQuery.refetch();
          }}
        />
      </div>
    );
  }


  return (
    <AppShell
      activeTab="inicio"
      header={<PageHeader title="Inicio" subtitle="Surpry" />}
    >
      <div className="space-y-4 pt-4">
        {sharesQuery.data.length > 0 ? (
          <Card className="space-y-3 bg-primary/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-text">Pagos pendientes</p>
                <p className="text-sm text-text-muted">Tienes {sharesQuery.data.length} share(s) que requieren accion.</p>
              </div>
              <Button onClick={() => navigate(`/shares/${sharesQuery.data[0].id}`)}>Ver</Button>
            </div>
          </Card>
        ) : null}

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Eventos activos</h2>
            <Link className="text-sm font-semibold text-primary-strong" to="/eventos">Ver todos</Link>
          </div>
          {eventsQuery.data.length === 0 ? (
            <p className="text-sm text-text-muted">Todavia no participas en ningun evento secreto.</p>
          ) : (
            eventsQuery.data.slice(0, 3).map((event) => (
              <Link key={event.id} to={`/eventos/${event.id}`} className="block rounded-2xl bg-surface-muted px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-text">{event.birthday_profile?.display_name || "Evento"}</p>
                    <p className="text-sm text-text-muted">{event.groups?.name} · {formatDate(event.birthday_date, { month: "short", day: "numeric" })}</p>
                  </div>
                  <StatusBadge status={event.status}>{event.status}</StatusBadge>
                </div>
              </Link>
            ))
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Notificaciones</h2>
            <span className="text-sm text-text-muted">{notificationsQuery.data.length}</span>
          </div>
          {notificationsQuery.data.length === 0 ? (
            <p className="text-sm text-text-muted">No tienes avisos recientes.</p>
          ) : (
            notificationsQuery.data.map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full rounded-2xl bg-surface-muted px-4 py-4 text-left"
                onClick={() => markReadMutation.mutate(item.id)}
              >
                <p className="text-sm font-semibold text-text">{item.type}</p>
                <p className="text-sm text-text-muted">{item.payload?.message || "Tienes una actualizacion nueva."}</p>
              </button>
            ))
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Proximos grupos</h2>
            <Link className="text-sm font-semibold text-primary-strong" to="/grupos">Ver grupos</Link>
          </div>
          {groupsQuery.data.length === 0 ? (
            <EmptyState
              icon="groups"
              title="Crea tu primer grupo"
              description="Empieza con familia, amigos o equipo de trabajo."
              actionLabel="Ir a grupos"
              onAction={() => navigate("/grupos")}
            />
          ) : (
            groupsQuery.data.slice(0, 3).map((group) => (
              <Link key={group.id} to={`/grupos/${group.id}`} className="block rounded-2xl bg-surface-muted px-4 py-4">
                <p className="text-base font-bold text-text">{group.name}</p>
                <p className="text-sm text-text-muted">Anticipacion automatica: {group.auto_create_days_before} dias</p>
              </Link>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}
