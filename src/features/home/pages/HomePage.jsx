import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { AvatarStack } from "../../../components/ui/AvatarStack";
import { Avatar } from "../../../components/ui/Avatar";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { WelcomeWizard } from "../../../components/ui/WelcomeWizard";
import { useAuth } from "../../auth/AuthContext";
import { listGroups } from "../../groups/service";
import { listEvents } from "../../events/service";
import {
  getPendingShares,
  getReportedShares,
  getUnreadNotifications,
  listManualBirthdays
} from "../service";
import {
  daysUntilBirthday,
  formatBirthday,
  formatCurrency
} from "../../../utils/format";
import { getEventState } from "../../../utils/events";
import { cn } from "../../../utils/cn";

export function HomePage() {
  const navigate = useNavigate();
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
    queryFn: () => getUnreadNotifications(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const reportedSharesQuery = useQuery({
    queryKey: ["reported-shares", user?.id],
    queryFn: () => getReportedShares(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const manualBirthdaysQuery = useQuery({
    queryKey: ["manual-birthdays", user?.id],
    queryFn: () => listManualBirthdays(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
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
    notificationsQuery.isLoading ||
    manualBirthdaysQuery.isLoading;

  if (isLoading) {
    return <LoadingState message="Preparando tu tablero..." fullScreen />;
  }

  const anyError =
    groupsQuery.error ||
    eventsQuery.error ||
    sharesQuery.error ||
    notificationsQuery.error ||
    manualBirthdaysQuery.error;

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
            manualBirthdaysQuery.refetch();
          }}
        />
      </div>
    );
  }

  const allMembers = (groupsQuery.data || []).flatMap((group) =>
    (group.members || [])
      .filter((member) => member.user_id !== user.id && member.profiles?.birthday_day)
      .map((member) => ({
        id: member.profiles.id,
        display_name: member.profiles.display_name,
        avatar_url: member.profiles.avatar_url,
        birthday_day: member.profiles.birthday_day,
        birthday_month: member.profiles.birthday_month,
        days: daysUntilBirthday(member.profiles.birthday_day, member.profiles.birthday_month),
        type: "profile"
      }))
  );

  const manualMembers = (manualBirthdaysQuery.data || []).map((member) => ({
    id: `manual_${member.id}`,
    display_name: member.display_name,
    avatar_url: null,
    birthday_day: member.birthday_day,
    birthday_month: member.birthday_month,
    days: daysUntilBirthday(member.birthday_day, member.birthday_month),
    type: "manual"
  }));

  const allBirthdays = [...allMembers, ...manualMembers]
    .filter((member) => member.days !== null)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  const firstName = user?.user_metadata?.display_name?.split(" ")[0] || "tú";
  const hour = new Date().getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const unreadCount = notificationsQuery.data?.length || 0;
  const pendingAmount = sharesQuery.data.reduce((acc, share) => acc + Number(share.amount_due || 0), 0);
  const featuredEvents = eventsQuery.data.slice(0, 2);

  return (
    <AppShell
      activeTab="inicio"
      header={(
        <PageHeader
          title={`${greeting}, ${firstName}`}
          action={(
            <button
              className="relative flex size-10 items-center justify-center rounded-full bg-surface shadow-card"
              onClick={() => navigate("/notificaciones")}
            >
              <span className="material-symbols-outlined text-[1.4rem] text-text-muted">
                notifications
              </span>
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-primary">
                  <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
                </span>
              )}
            </button>
          )}
        />
      )}
    >
      {showWelcome && <WelcomeWizard onComplete={handleWelcomeComplete} />}

      <div className="space-y-6 pt-4 pb-12">
        {sharesQuery.data.length > 0 && (
          <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-primary/12 via-surface to-bg p-4 animate-in fade-in slide-in-from-top-6 duration-700">
            <div className="flex items-center gap-4">
              <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-slate-950 shadow-float">
                <span className="material-symbols-outlined text-[1.35rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  payments
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
                  Pago pendiente
                </p>
                <h3 className="text-xl font-black text-text">
                  {formatCurrency(pendingAmount)}
                </h3>
                <p className="text-sm text-text-muted">
                  {sharesQuery.data.length === 1
                    ? "Tienes un aporte por resolver."
                    : `Tienes ${sharesQuery.data.length} aportes por resolver.`}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full px-4"
                onClick={() => navigate(`/shares/${sharesQuery.data[0].id}`)}
              >
                Ver
              </Button>
            </div>
          </Card>
        )}

        {reportedSharesQuery.data?.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-black tracking-tight text-text uppercase">En revisión</h2>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                {reportedSharesQuery.data.length} pendientes
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              {reportedSharesQuery.data.map((share) => (
                <Card
                  key={share.id}
                  className="w-[240px] flex-shrink-0 cursor-pointer bg-surface-muted/30 p-4 active:scale-95"
                  onClick={() => navigate(`/shares/${share.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                      <span className="material-symbols-outlined text-[1.25rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        hourglass_top
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-text">{share.expenses?.title}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">
                        Cómplice revisando
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {allBirthdays.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-text">
                <span className="material-symbols-outlined scale-90 text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  cake
                </span>
                Cumples cerca
              </h2>
              <Link
                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary hover:text-slate-900"
                to="/cumpleanios"
              >
                Ver todos
              </Link>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              {allBirthdays.map((member) => (
                <div
                  key={member.id}
                  className="w-[120px] flex-shrink-0 cursor-pointer"
                  onClick={() => {
                    if (member.type === "profile") {
                      navigate(`/perfil/${member.id}`);
                    }
                  }}
                >
                  <Card className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Avatar
                        name={member.display_name}
                        url={member.avatar_url}
                        className={cn("size-12 shadow-card", member.type === "manual" && "opacity-80")}
                        ring
                      />
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em]",
                          member.days === 0
                            ? "bg-success/15 text-success"
                            : "bg-primary/12 text-primary-strong"
                        )}
                      >
                        {member.days === 0 ? "Hoy" : member.days === 1 ? "Mañana" : `${member.days}d`}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="line-clamp-2 text-sm font-black leading-tight text-text">
                        {member.display_name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatBirthday(member.birthday_day, member.birthday_month)}
                      </p>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-black tracking-tight text-text">Planes activos</h2>
            <Link className="text-[10px] font-black uppercase tracking-widest text-primary" to="/eventos">
              Ver todos
            </Link>
          </div>

          {eventsQuery.data.length === 0 ? (
            <Card className="space-y-4 border-dashed p-8 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-[1.5rem] bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-4xl">auto_awesome_motion</span>
              </div>
              <div className="space-y-2">
                <p className="text-base font-black text-text">Todavía no hay sorpresas en camino</p>
                <p className="text-sm leading-relaxed text-text-muted">
                  Cuando abras un plan desde un grupo, aquí vas a ver lo importante sin tener que entrar a cada pantalla.
                </p>
              </div>
              <Button variant="secondary" size="pill" className="mx-auto max-w-xs" onClick={() => navigate("/grupos")}>
                Ir a mis grupos
              </Button>
            </Card>
          ) : (
            featuredEvents.map((event) => {
              const eventState = getEventState(event);
              const participants = event.participants || [];

              return (
                <Link key={event.id} to={`/eventos/${event.id}`} className="block transition-all active:scale-[0.99]">
                  <Card className="space-y-4 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-primary/10">
                        <span className="material-symbols-outlined text-[1.5rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {event.event_type === "gathering" ? "groups" : "celebration"}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
                            {eventState.typeLabel}
                          </span>
                          <StatusBadge status={eventState.displayStatus} size="sm">
                            {eventState.badgeLabel}
                          </StatusBadge>
                        </div>

                        <div className="space-y-1">
                          <h3 className="truncate text-base font-black text-text">
                            {event.event_type === "gathering"
                              ? event.title || "Convivio"
                              : `Cumple de ${event.birthday_profile?.display_name?.split(" ")[0] || "alguien"}`}
                          </h3>
                          <p className="text-sm text-text-muted">
                            {eventState.listHint}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted">
                          {event.groups?.name || "Plan privado"}
                        </p>
                        <p className="text-sm font-semibold text-text">
                          {eventState.timingLabel}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <AvatarStack
                          users={participants.map((participant) => ({
                            name: participant.profiles?.display_name,
                            avatar_url: participant.profiles?.avatar_url
                          }))}
                          max={3}
                        />
                        <span className="text-xs font-black uppercase tracking-[0.15em] text-text-muted">
                          {participants.length}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        {groupsQuery.data.length === 0 && eventsQuery.data.length === 0 && (
          <div className="px-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
            <Card className="space-y-6 border-primary/20 bg-gradient-to-br from-primary/10 to-bg p-8 text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-[1.75rem] bg-primary/20 shadow-float">
                <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  add_task
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-text">Empieza la magia</h3>
                <p className="text-sm leading-relaxed text-text-muted">
                  Crea un grupo con tus personas cercanas para no volver a improvisar un cumpleaños importante.
                </p>
              </div>
              <Button size="pill" className="w-full" onClick={() => navigate("/grupos")}>
                Ir a mis grupos
              </Button>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
