import { useState, useEffect } from "react";
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
import { WelcomeWizard } from "../../../components/ui/WelcomeWizard";
import { useAuth } from "../../auth/AuthContext";
import { listGroups } from "../../groups/service";
import { listEvents } from "../../events/service";
import { requireSupabase } from "../../../lib/supabase";
import { formatDate, formatCurrency } from "../../../utils/format";

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
  const [showWelcome, setShowWelcome] = useState(false);

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

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("has_seen_welcome_v1");
    if (!hasSeenWelcome && groupsQuery.isSuccess && groupsQuery.data.length === 0) {
      setShowWelcome(true);
    }
  }, [groupsQuery.isSuccess, groupsQuery.data]);

  const handleWelcomeComplete = () => {
    localStorage.setItem("has_seen_welcome_v1", "true");
    setShowWelcome(false);
  };

  const isLoading =
    groupsQuery.isLoading ||
    eventsQuery.isLoading ||
    sharesQuery.isLoading ||
    notificationsQuery.isLoading;

  if (isLoading) return <LoadingState message="Preparando tu tablero..." fullScreen />;

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
              onClick={() => navigate("/notificaciones")}
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
      {showWelcome && <WelcomeWizard onComplete={handleWelcomeComplete} />}

      <div className="space-y-6 pt-4 pb-12">
        {/* Pending payment banner */}
        {sharesQuery.data.length > 0 && (
          <div className="flex items-center gap-4 rounded-3xl bg-primary/12 px-4 py-4 border border-primary/20">
            <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/20">
              <span className="material-symbols-outlined text-[1.4rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                payments
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text">Saldos pendientes</p>
              <p className="truncate text-sm text-text-muted font-medium">
                Debes {formatCurrency(sharesQuery.data.reduce((acc, s) => acc + Number(s.amount_due || 0), 0))} en {sharesQuery.data.length} planes.
              </p>
            </div>
            <Button size="md" onClick={() => navigate(`/shares/${sharesQuery.data[0].id}`)}>Ver</Button>
          </div>
        )}

        {/* Upcoming birthdays */}
        {upcomingBirthdays.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-black tracking-tight text-text">Próximos cumpleañeros</h2>
              <Link className="text-xs font-bold text-primary uppercase tracking-wider" to="/grupos">Ver todos</Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 no-scrollbar">
              {upcomingBirthdays.map((member, i) => (
                <div key={i} className="flex flex-shrink-0 flex-col items-center gap-2">
                  <div className="relative group active:scale-95 transition-transform">
                    <Avatar name={member.display_name} url={member.avatar_url} className="size-16 ring-4 ring-bg" ring />
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-float ring-2 ring-bg">
                      {member.days}d
                    </span>
                  </div>
                  <p className="max-w-[4.5rem] truncate text-center text-[11px] font-bold text-text">
                    {member.display_name?.split(" ")[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active events */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-black tracking-tight text-text">Planes activos</h2>
            <Link className="text-xs font-bold text-primary uppercase tracking-wider" to="/eventos">Ver todos</Link>
          </div>
          {eventsQuery.data.length === 0 ? (
            <div className="rounded-[2rem] bg-surface-muted/30 border border-dashed border-border p-8 text-center space-y-3">
              <span className="material-symbols-outlined text-text-muted/20 text-5xl">auto_awesome</span>
              <p className="text-sm text-text-muted font-medium italic">
                \"¿Shhh... todavía no hay sorpresas en camino?\"
              </p>
              <Button variant="secondary" size="md" onClick={() => navigate("/grupos")}>Crear grupo</Button>
            </div>
          ) : (
            eventsQuery.data.slice(0, 3).map((event) => {
              const totalExpenses = (event.expenses || []).reduce((acc, e) => acc + Number(e.amount || 0), 0);
              const priceEstimate = event.gift_options?.[0]?.price_estimate || 0;
              const progress = priceEstimate > 0 ? Math.min(100, Math.round((totalExpenses / priceEstimate) * 100)) : 0;
              const participants = event.event_participants || [];

              return (
                <Link key={event.id} to={`/eventos/${event.id}`} className="block">
                  <Card className="space-y-4 hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                          <span className="material-symbols-outlined text-[1.4rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                            celebration
                          </span>
                        </div>
                        <div>
                          <p className="font-black text-text">Para {event.birthday_profile?.display_name?.split(" ")[0] || "Alguien"}</p>
                          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                            {event.groups?.name} · {participants.length} Cómplices
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={event.status}>{event.status === 'active' ? 'En marcha' : event.status}</StatusBadge>
                    </div>

                    {priceEstimate > 0 && (
                      <ProgressBar label="Fondo recolectado" rightLabel={`${progress}%`} value={progress} />
                    )}

                    <div className="flex items-center justify-between">
                      <AvatarStack users={participants.map((p) => ({ id: p.user_id, name: p.profiles?.display_name, avatar_url: p.profiles?.avatar_url }))} max={3} />
                      {priceEstimate > 0 && (
                        <p className="text-xs font-black text-text-muted">
                          Objetivo: <span className="text-text">{formatCurrency(priceEstimate)}</span>
                        </p>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        {/* Groups Empty State (if needed) */}
        {groupsQuery.data.length === 0 && eventsQuery.data.length === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300 px-2">
            <Card className="bg-gradient-to-br from-primary/10 to-bg border-primary/20 p-8 text-center space-y-6">
              <div className="size-20 bg-primary/20 rounded-[1.75rem] flex items-center justify-center mx-auto shadow-float">
                <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>add_task</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-text">¡Empieza la magia!</h3>
                <p className="text-sm text-text-muted leading-relaxed">Crea un grupo con tus amigos más cercanos para que nunca se les pase otro cumpleaños.</p>
              </div>
              <Button size="pill" className="w-full" onClick={() => navigate("/grupos")}>Ir a mis grupos</Button>
            </Card>
          </div>
        )}

        {/* New surprise CTA */}
        {groupsQuery.data.length > 0 && (
          <Button size="pill" className="gap-3 shadow-xl active:scale-95 transition-all text-lg font-black h-16 w-full mt-4" onClick={() => navigate("/grupos")}>
            <span className="material-symbols-outlined text-[1.5rem]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            Planear nueva sorpresa
          </Button>
        )}
      </div>
    </AppShell>
  );
}
