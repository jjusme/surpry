import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { shootBirthday } from "../../../utils/confetti";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { AvatarStack } from "../../../components/ui/AvatarStack";
import { Avatar } from "../../../components/ui/Avatar";
import { NotificationBell } from "../../../components/ui/NotificationBell";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { WelcomeWizard } from "../../../components/ui/WelcomeWizard";
import { useAuth } from "../../auth/AuthContext";
import { listGroups } from "../../groups/service";
import { listEvents } from "../../events/service";
import { listMyExchanges } from "../../exchanges/service";
import {
  getPendingShares,
  getReportedShares,
  getUnreadNotifications,
  listManualBirthdays
} from "../service";
import {
  daysUntilBirthday,
  formatBirthday,
  formatCurrency,
  getBirthdayCountdownLabel
} from "../../../utils/format";
import { getEventState } from "../../../utils/events";
import { cn } from "../../../utils/cn";

export function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);

  const myProfile = qc.getQueryData(["profile-setup-check", user?.id]);
  const isMyBirthday = daysUntilBirthday(myProfile?.birthday_day, myProfile?.birthday_month) === 0;

  useEffect(() => {
    if (!isMyBirthday || !user?.id) return;
    const key = `surpry_confetti_bday_${user.id}_${new Date().getFullYear()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    shootBirthday();
  }, [isMyBirthday, user?.id]);

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
  const exchangesQuery = useQuery({
    queryKey: ["my-exchanges", user?.id],
    queryFn: () => listMyExchanges(user.id),
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
    exchangesQuery.isLoading ||
    sharesQuery.isLoading ||
    notificationsQuery.isLoading ||
    manualBirthdaysQuery.isLoading;

  if (isLoading) {
    return <LoadingState message="Preparando tu tablero..." fullScreen />;
  }

  const anyError =
    groupsQuery.error ||
    eventsQuery.error ||
    exchangesQuery.error ||
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
    .slice(0, 4);

  const firstName = user?.user_metadata?.display_name?.split(" ")[0] || "tú";
  const hour = new Date().getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const unreadCount = notificationsQuery.data?.length || 0;
  const pendingAmount = sharesQuery.data.reduce((acc, share) => acc + Number(share.amount_due || 0), 0);

  const activeExchanges = (exchangesQuery.data || []).filter((ex) => ex.status !== "closed");
  const allPlans = [
    ...eventsQuery.data.map((e) => ({ _type: "event", ...e })),
    ...activeExchanges.map((ex) => ({ _type: "exchange", ...ex }))
  ].slice(0, 4);

  return (
    <AppShell
      activeTab="inicio"
      header={(
        <PageHeader action={<NotificationBell />} />
      )}
    >
      {showWelcome && <WelcomeWizard onComplete={handleWelcomeComplete} />}

      <div className="space-y-6 pt-4 pb-12">
        {isMyBirthday ? (
          <section className="space-y-2 px-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-warning">
              Hoy es tu día
            </p>
            <h2 className="text-[1.9rem] font-black tracking-tight text-text">
              ¡Feliz cumpleaños, {firstName}! 🎂
            </h2>
            <p className="text-sm leading-relaxed text-text-muted">
              Que este año esté lleno de sorpresas increíbles.
            </p>
          </section>
        ) : (
          <section className="space-y-2 px-1">
            <p className="text-sm">
              <span className="font-black">{greeting},</span>{" "}
              <span className="font-bold uppercase text-primary">{firstName}</span>
            </p>
          </section>
        )}

        {/* Banner festivo de cumpleaños */}
        {isMyBirthday && (
          <div
            className="relative overflow-hidden rounded-2xl p-5 animate-in fade-in slide-in-from-top-4 duration-700"
            style={{ background: "linear-gradient(135deg, #92400e 0%, #d97706 50%, #fbbf24 100%)" }}
          >
            <span
              className="material-symbols-outlined absolute right-3 top-2 text-white/20 text-[2.5rem] select-none"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              cake
            </span>
            <span
              className="material-symbols-outlined absolute right-12 bottom-2 text-white/10 text-[1.4rem] select-none"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <div className="flex items-center gap-4">
              <button
                className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl animate-pulse active:scale-90 transition-transform cursor-pointer"
                onClick={shootBirthday}
              >
                🎉
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                  Surpry te desea
                </p>
                <p className="text-lg font-black text-white leading-tight">
                  Un día increíble
                </p>
                <p className="text-sm text-white/75">
                  Cada año merece celebrarse a lo grande.
                </p>
              </div>
            </div>
          </div>
        )}

                {/* Próximos cumpleaños */}
        {allBirthdays.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-text">
                <span
                  className="material-symbols-outlined text-[1.2rem] text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  cake
                </span>
                Próximos cumpleaños
              </h2>
              <Link
                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary hover:text-white"
                to="/cumpleanios"
              >
                Ver todos
              </Link>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 no-scrollbar">
              {allBirthdays.map((member) => (
                <div
                  key={member.id}
                  className="flex-shrink-0 w-[88px] text-center cursor-pointer"
                  onClick={() => {
                    if (member.type === "profile") navigate(`/perfil/${member.id}`);
                  }}
                >
                  {/* Avatar circular con badge de días superpuesto */}
                  <div className="relative mx-auto mb-3 size-[68px]">
                    <Avatar
                      name={member.display_name}
                      url={member.avatar_url}
                      className={cn("size-[68px]", member.type === "manual" && "opacity-80")}
                      ring
                      ringClassName={member.days === 0 ? "bg-gradient-to-tr from-yellow-400 to-amber-400 shadow-lg" : undefined}
                    />
                    <span
                      className={cn(
                        "absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-black shadow-card",
                        member.days === 0
                          ? "bg-success text-white"
                          : "bg-primary text-white"
                      )}
                    >
                      {getBirthdayCountdownLabel(member.days, { short: true })}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-[13px] font-bold text-text leading-tight">
                    {member.display_name?.split(" ")[0]}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {formatBirthday(member.birthday_day, member.birthday_month)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment banner — dark gradient, high presence */}
        {sharesQuery.data.length > 0 && (
          <div
            className="relative overflow-hidden rounded-2xl p-5 animate-in fade-in slide-in-from-top-6 duration-700"
            style={{ background: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 60%, #7c3aed 100%)" }}
          >
            {/* Sparkle decorations */}
            <span
              className="material-symbols-outlined absolute right-4 top-3 text-white/20 text-[2rem] select-none"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <span
              className="material-symbols-outlined absolute right-10 bottom-3 text-white/10 text-[1.2rem] select-none"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>

            <div className="flex items-center gap-4">
              <div className="flex size-13 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <span
                  className="material-symbols-outlined text-[1.5rem] text-white"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  payments
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                  Pendiente
                </p>
                <h3 className="text-2xl font-black text-white leading-tight">
                  {formatCurrency(pendingAmount)}
                </h3>
                <p className="text-sm text-white/70">
                  {sharesQuery.data.length === 1
                    ? "1 gasto pendiente"
                    : `${sharesQuery.data.length} gastos pendientes`}
                </p>
              </div>

              <button
                className="flex-shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-black text-primary-strong shadow-float transition-all active:scale-95"
                onClick={() => navigate(`/shares/${sharesQuery.data[0].id}`)}
              >
                PAGAR
              </button>
            </div>
          </div>
        )}

        {/* En revisión */}
        {reportedSharesQuery.data?.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-black tracking-tight text-text">En revisión</h2>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                {reportedSharesQuery.data.length} pendientes
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              {reportedSharesQuery.data.map((share) => (
                <Card
                  key={share.id}
                  className="w-[220px] flex-shrink-0 cursor-pointer p-4 active:scale-95"
                  onClick={() => navigate(`/shares/${share.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
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



        {/* Planes activos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-black tracking-tight text-text">Planes activos</h2>
            <Link
              className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-primary"
              to="/eventos"
            >
              Ver todos
            </Link>
          </div>

          {allPlans.length === 0 ? (
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
            <div className="space-y-3">
              {allPlans.map((plan) => {
                if (plan._type === "exchange") {
                  const EXCHANGE_STATUS = { open: "Abierto", drawn: "Sorteado", closed: "Cerrado" };
                  return (
                    <Link key={`ex-${plan.id}`} to={`/intercambios/${plan.id}`} className="block transition-all active:scale-[0.99]">
                      <Card className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/15">
                            <span className="material-symbols-outlined text-[1.4rem] text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>redeem</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-black text-text">{plan.name}</h3>
                            <p className="text-xs text-text-muted mt-0.5">{plan.groups?.name || "Intercambio"} · 🎄</p>
                          </div>
                          <span className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]",
                            plan.status === "drawn" ? "bg-success/15 text-success" : "bg-green-500/15 text-green-700"
                          )}>
                            {EXCHANGE_STATUS[plan.status] || "Abierto"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          {plan.budget ? (
                            <div className="flex items-center justify-between rounded-xl bg-surface-muted/60 px-3 py-2 flex-1 mr-3">
                              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Presupuesto</span>
                              <span className="text-sm font-black text-green-700">{formatCurrency(plan.budget)}</span>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-green-500/20 px-3 py-2 text-center flex-1 mr-3">
                              <span className="text-xs font-bold text-green-600/50 uppercase tracking-wider">Sin presupuesto</span>
                            </div>
                          )}
                          <span className="text-xs font-black uppercase tracking-[0.15em] text-text-muted flex-shrink-0">
                            {plan.participant_count} participantes
                          </span>
                        </div>
                      </Card>
                    </Link>
                  );
                }

                const eventState = getEventState(plan);
                const participants = plan.participants || [];
                const budget = plan.budget;

                return (
                  <Link key={`ev-${plan.id}`} to={`/eventos/${plan.id}`} className="block transition-all active:scale-[0.99]">
                    <Card className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                          <span
                            className="material-symbols-outlined text-[1.4rem] text-primary"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {plan.event_type === "gathering" ? "groups" : "celebration"}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-black text-text">
                            {plan.event_type === "gathering"
                              ? plan.title || "Convivio"
                              : `Cumple de ${plan.birthday_profile?.display_name?.split(" ")[0] || "alguien"}`}
                          </h3>
                          <p className="text-xs text-text-muted mt-0.5">
                            {plan.groups?.name || "Plan privado"}
                          </p>
                        </div>
                        <StatusBadge status={eventState.displayStatus} size="sm">
                          {eventState.badgeLabel}
                        </StatusBadge>
                      </div>
                      {budget ? (
                        <div className="flex items-center justify-between rounded-xl bg-surface-muted/60 px-3 py-2">
                          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Presupuesto</span>
                          <span className="text-sm font-black text-primary-strong">{formatCurrency(budget)}</span>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-primary/20 px-3 py-2 text-center">
                          <span className="text-xs font-bold text-primary/50 uppercase tracking-wider">
                            Sin presupuesto definido aún
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AvatarStack
                            users={participants.map((p) => ({
                              name: p.profiles?.display_name,
                              avatar_url: p.profiles?.avatar_url
                            }))}
                            max={4}
                          />
                          <span className="text-xs font-black uppercase tracking-[0.15em] text-text-muted">
                            {participants.length} cómplices
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-text-muted">
                          {eventState.timingLabel}
                        </span>
                      </div>
                    </Card>
                  </Link>
                );
              })}

              {/* CTA "Planear nueva sorpresa" */}
              <button
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-black text-white text-base transition-all active:scale-[0.98] shadow-float"
                style={{ background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)" }}
                onClick={() => navigate("/grupos")}
              >
                <span
                  className="material-symbols-outlined text-[1.3rem]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
                Planear nueva sorpresa
              </button>
            </div>
          )}
        </div>

        {groupsQuery.data.length === 0 && eventsQuery.data.length === 0 && (
          <div className="px-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
            <Card className="space-y-6 border-primary/20 bg-gradient-to-br from-primary/10 to-bg p-8 text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-[1.75rem] bg-primary/20 shadow-float">
                <span
                  className="material-symbols-outlined text-4xl text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
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
