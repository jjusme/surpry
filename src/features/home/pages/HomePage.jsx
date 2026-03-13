import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { AvatarStack } from "../../../components/ui/AvatarStack";
import { Avatar } from "../../../components/ui/Avatar";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { useAuth } from "../../auth/AuthContext";
import { listGroups } from "../../groups/service";
import { listEvents } from "../../events/service";
import { requireSupabase } from "../../../lib/supabase";
import { formatDate, formatCurrency, formatBirthday } from "../../../utils/format";

async function getPendingShares(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("expense_shares")
    .select(`*, expenses (id, title, amount, event_id)`)
    .eq("user_id", userId)
    .in("status", ["pending", "rejected", "reported_paid"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data ?? [];
}

async function getNotifications(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data ?? [];
}

/** Computes how many days from today to a day/month birthday */
function daysUntilBirthday(day, month) {
  if (!day || !month) return null;
  const today = new Date();
  const year = today.getFullYear();
  let next = new Date(year, month - 1, day);
  if (next < today) next = new Date(year + 1, month - 1, day);
  return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
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
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user.id] })
  });

  const isLoading =
    groupsQuery.isLoading ||
    eventsQuery.isLoading ||
    sharesQuery.isLoading ||
    notificationsQuery.isLoading;

  if (isLoading) return <LoadingState message="Cargando tu tablero..." fullScreen />;

  const anyError =
    groupsQuery.error || eventsQuery.error || sharesQuery.error || notificationsQuery.error;
  if (anyError) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tu inicio"
          description={anyError.message}
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

  // Build upcoming birthdays list from group members
  const allMembers = (groupsQuery.data || []).flatMap((g) =>
    (g.members || []).filter(
      (m) => m.user_id !== user.id && m.profiles?.birthday_day
    ).map((m) => ({
      ...m.profiles,
      days: daysUntilBirthday(m.profiles.birthday_day, m.profiles.birthday_month)
    }))
  );
  const upcomingBirthdays = allMembers
    .filter((m) => m.days !== null)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  const firstName = user?.user_metadata?.display_name?.split(" ")[0] || "tú";
  const hour = new Date().getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const unreadCount = notificationsQuery.data?.length || 0;

  return (
    <AppShell
      activeTab="inicio"
      header={
        <PageHeader
          title={`${greeting}, ${firstName}`}
          action={
            <button
              className="relative flex size-10 items-center justify-center rounded-full bg-surface shadow-card"
              onClick={() => navigate("/inicio")}
            >
              <span className="material-symbols-outlined text-[1.4rem] text-text-muted">
                notifications
              </span>
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-primary" />
              )}
            </button>
          }
        />
      }
    >
      <div className="space-y-5 pt-4">
        {/* Pending payment banner */}
        {sharesQuery.data.length > 0 && (
          <div className="flex items-center gap-4 rounded-3xl bg-primary/12 px-4 py-4">
            <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/20">
              <span
                className="material-symbols-outlined text-[1.4rem] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                payments
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text">Pago pendiente</p>
              <p className="truncate text-sm text-text-muted">
                Debes{" "}
                {formatCurrency(
                  sharesQuery.data.reduce((acc, s) => acc + Number(s.amount_due || 0), 0)
                )}{" "}
                en {sharesQuery.data.length} pendiente(s)
              </p>
            </div>
            <Button
              size="md"
              onClick={() => navigate(`/shares/${sharesQuery.data[0].id}`)}
            >
              Ver
            </Button>
          </div>
        )}

        {/* Upcoming birthdays horizontal scroll */}
        {upcomingBirthdays.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text">Próximos cumpleaños</h2>
              <Link className="text-sm font-semibold text-primary" to="/grupos">
                Ver todos
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {upcomingBirthdays.map((member, i) => (
                <div key={i} className="flex flex-shrink-0 flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar
                      name={member.display_name}
                      url={member.avatar_url}
                      className="size-16 text-base"
                      ring
                    />
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-float">
                      {member.days}d
                    </span>
                  </div>
                  <p className="max-w-[4rem] truncate text-center text-[11px] font-semibold text-text">
                    {member.display_name?.split(" ")[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active events */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Eventos activos</h2>
            <Link className="text-sm font-semibold text-primary" to="/eventos">
              Ver todos
            </Link>
          </div>
          {eventsQuery.data.length === 0 ? (
            <EmptyState
              icon="celebration"
              title="Sin eventos activos"
              description="Todavía no participas en ningún evento secreto."
            />
          ) : (
            eventsQuery.data.slice(0, 3).map((event) => {
              const totalExpenses = (event.expenses || []).reduce(
                (acc, e) => acc + Number(e.amount || 0),
                0
              );
              const priceEstimate = event.gift_options?.[0]?.price_estimate || 0;
              const progress =
                priceEstimate > 0
                  ? Math.min(100, Math.round((totalExpenses / priceEstimate) * 100))
                  : 0;
              const participants = event.event_participants || [];

              return (
                <Link key={event.id} to={`/eventos/${event.id}`} className="block">
                  <Card className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/12">
                          <span
                            className="material-symbols-outlined text-[1.4rem] text-primary"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            cake
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-text">
                            {event.birthday_profile?.display_name || "Evento"}
                          </p>
                          <p className="text-xs text-text-muted">
                            {event.groups?.name} · {participants.length} personas
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={event.status}>{event.status}</StatusBadge>
                    </div>

                    {priceEstimate > 0 && (
                      <ProgressBar
                        label="Recolectado"
                        rightLabel={`${progress}%`}
                        value={progress}
                      />
                    )}

                    <div className="flex items-center justify-between">
                      <AvatarStack
                        users={participants.map((p) => ({
                          id: p.user_id,
                          name: p.profiles?.display_name,
                          avatar_url: p.profiles?.avatar_url
                        }))}
                        max={3}
                      />
                      {priceEstimate > 0 && (
                        <p className="text-xs text-text-muted">
                          Meta: {formatCurrency(priceEstimate)}
                        </p>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        {/* Notifications */}
        {notificationsQuery.data.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-text">Avisos</h2>
            {notificationsQuery.data.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-start gap-3 rounded-2xl bg-surface px-4 py-4 text-left shadow-card"
                onClick={() => markReadMutation.mutate(item.id)}
              >
                <span
                  className="material-symbols-outlined mt-0.5 text-[1.25rem] text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  notifications
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">{item.type}</p>
                  <p className="text-sm text-text-muted">
                    {item.payload?.message || "Tienes una actualización nueva."}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Groups */}
        {groupsQuery.data.length === 0 && (
          <EmptyState
            icon="groups"
            title="Crea tu primer grupo"
            description="Empieza con familia, amigos o equipo de trabajo."
            actionLabel="Ir a grupos"
            onAction={() => navigate("/grupos")}
          />
        )}

        {/* New event CTA */}
        <Button
          size="pill"
          className="gap-3"
          onClick={() => navigate("/grupos")}
        >
          <span className="material-symbols-outlined text-[1.25rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
            add_circle
          </span>
          Nueva misión de regalo
        </Button>
      </div>
    </AppShell>
  );
}
