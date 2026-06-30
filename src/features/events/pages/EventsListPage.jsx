import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../auth/AuthContext";
import { listEvents } from "../service";
import { formatDate } from "../../../utils/format";
import { getEventState } from "../../../utils/events";

export function EventsListPage() {
  const navigate = useNavigate();
  const { user, isSupabaseConfigured } = useAuth();
  const listQuery = useQuery({
    queryKey: ["events", user?.id],
    queryFn: () => listEvents(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });

  if (listQuery.isLoading) {
    return <LoadingState message="Cargando eventos..." fullScreen />;
  }

  if (listQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tus eventos"
          description={listQuery.error.message}
          onRetry={listQuery.refetch}
        />
      </div>
    );
  }

  return (
    <AppShell
      activeTab="eventos"
      header={(
        <PageHeader
          title="Eventos"
          subtitle={`${listQuery.data.length} plan${listQuery.data.length === 1 ? "" : "es"} visibles`}
          action={(
            <Button
              size="sm"
              className="h-9 rounded-full px-4 text-[10px] font-black uppercase tracking-widest shadow-float"
              onClick={() => navigate("/eventos/nuevo-convivio")}
            >
              Nuevo convivio
            </Button>
          )}
        />
      )}
    >
      <div className="space-y-4 pt-4">
        {listQuery.data.length === 0 ? (
          <EmptyState
            icon="celebration"
            title="Todavía no participas en eventos"
            description="Crea uno manualmente desde un grupo o espera a que se generen automáticamente."
          />
        ) : (
          listQuery.data.map((event) => {
            const eventState = getEventState(event);
            const participantsCount = event.participants?.length || 0;

            return (
              <Link key={event.id} to={`/eventos/${event.id}`} className="block transition-all active:scale-[0.99]">
                <Card className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-primary/10">
                      <span
                        className="material-symbols-outlined text-[1.5rem] text-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {event.event_type === "gathering" ? "groups" : "cake"}
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

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                      <span className="material-symbols-outlined text-[1rem]">calendar_today</span>
                      {formatDate(event.birthday_date, { day: "numeric", month: "short" })}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                      <span className="material-symbols-outlined text-[1rem]">group</span>
                      {participantsCount} {participantsCount === 1 ? "persona" : "personas"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                      <span className="material-symbols-outlined text-[1rem]">folder</span>
                      {event.groups?.name || "Plan privado"}
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
