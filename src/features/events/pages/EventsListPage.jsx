import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { NotificationBell } from "../../../components/ui/NotificationBell";
import { Card } from "../../../components/ui/Card";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../auth/AuthContext";
import { listEvents } from "../service";
import { listMyExchanges } from "../../exchanges/service";
import { formatDate, formatCurrency } from "../../../utils/format";
import { getEventState } from "../../../utils/events";
import { cn } from "../../../utils/cn";

export function EventsListPage() {
  const navigate = useNavigate();
  const { user, isSupabaseConfigured } = useAuth();
  const listQuery = useQuery({
    queryKey: ["events", user?.id],
    queryFn: () => listEvents(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const exchangesQuery = useQuery({
    queryKey: ["my-exchanges", user?.id],
    queryFn: () => listMyExchanges(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });

  if (listQuery.isLoading || exchangesQuery.isLoading) {
    return <LoadingState message="Cargando eventos..." fullScreen />;
  }

  if (listQuery.error || exchangesQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tus eventos"
          description={listQuery.error?.message || exchangesQuery.error?.message}
          onRetry={() => { listQuery.refetch(); exchangesQuery.refetch(); }}
        />
      </div>
    );
  }

  const EXCHANGE_STATUS = { open: "Abierto", drawn: "Sorteado", closed: "Cerrado" };
  const allItems = [
    ...(listQuery.data || []).map((e) => ({ _type: "event", ...e })),
    ...(exchangesQuery.data || []).map((ex) => ({ _type: "exchange", ...ex }))
  ];

  return (
    <AppShell
      activeTab="eventos"
      header={(
        <PageHeader action={<NotificationBell />} />
      )}
    >
      <div className="space-y-4 pt-4">
        <section className="space-y-2 px-1">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
            Eventos
          </p>
          <h2 className="text-[1.9rem] font-black tracking-tight text-text">
            Planes en marcha
          </h2>
          <p className="text-sm leading-relaxed text-text-muted">
            Aquí viven todas las sorpresas que estás organizando con tu gente.
          </p>
          <Button
            size="sm"
            className="mt-1 h-9 rounded-full px-5 text-[10px] font-black uppercase tracking-widest shadow-float"
            onClick={() => navigate("/eventos/nuevo-convivio")}
          >
            + Nuevo convivio
          </Button>
        </section>

        {allItems.length === 0 ? (
          <EmptyState
            icon="celebration"
            title="Todavía no participas en eventos"
            description="Crea uno manualmente desde un grupo o espera a que se generen automáticamente."
          />
        ) : (
          allItems.map((item) => {
            if (item._type === "exchange") {
              return (
                <Link key={`ex-${item.id}`} to={`/intercambios/${item.id}`} className="block transition-all active:scale-[0.99]">
                  <Card className="space-y-4 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-green-500/20 to-emerald-600/15">
                        <span className="material-symbols-outlined text-[1.5rem] text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>redeem</span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-green-700">
                            🎄 Intercambio
                          </span>
                          <span className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
                            item.status === "drawn" ? "bg-success/15 text-success" : item.status === "closed" ? "bg-surface-muted text-text-muted" : "bg-green-500/15 text-green-700"
                          )}>
                            {EXCHANGE_STATUS[item.status] || "Abierto"}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="truncate text-base font-black text-text">{item.name}</h3>
                          <p className="text-sm text-text-muted">{item.groups?.name || "Intercambio navideño"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.exchange_date && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                          <span className="material-symbols-outlined text-[1rem]">calendar_today</span>
                          {formatDate(item.exchange_date, { day: "numeric", month: "short" })}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                        <span className="material-symbols-outlined text-[1rem]">group</span>
                        {item.participant_count} {item.participant_count === 1 ? "persona" : "personas"}
                      </span>
                      {item.budget && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-green-700">
                          <span className="material-symbols-outlined text-[1rem]">payments</span>
                          {formatCurrency(item.budget)}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            }

            const eventState = getEventState(item);
            const participantsCount = item.participants?.length || 0;

            return (
              <Link key={`ev-${item.id}`} to={`/eventos/${item.id}`} className="block transition-all active:scale-[0.99]">
                <Card className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-primary/10">
                      <span
                        className="material-symbols-outlined text-[1.5rem] text-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {item.event_type === "gathering" ? "groups" : "cake"}
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
                          {item.event_type === "gathering"
                            ? item.title || "Convivio"
                            : `Cumple de ${item.birthday_profile?.display_name?.split(" ")[0] || "alguien"}`}
                        </h3>
                        <p className="text-sm text-text-muted">{eventState.listHint}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                      <span className="material-symbols-outlined text-[1rem]">calendar_today</span>
                      {formatDate(item.birthday_date, { day: "numeric", month: "short" })}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                      <span className="material-symbols-outlined text-[1rem]">group</span>
                      {participantsCount} {participantsCount === 1 ? "persona" : "personas"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                      <span className="material-symbols-outlined text-[1rem]">folder</span>
                      {item.groups?.name || "Plan privado"}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
