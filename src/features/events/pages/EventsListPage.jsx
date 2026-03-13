import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { useAuth } from "../../auth/AuthContext";
import { listEvents } from "../service";
import { formatDate } from "../../../utils/format";

export function EventsListPage() {
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
      header={<PageHeader title="Eventos" subtitle="Operaciones activas" />}
    >
      <div className="space-y-4 pt-4">
        {listQuery.data.length === 0 ? (
          <EmptyState
            icon="celebration"
            title="Todavia no participas en eventos"
            description="Crea uno manualmente desde un grupo o espera la automatizacion de cumpleanos."
          />
        ) : (
          listQuery.data.map((event) => (
            <Link key={event.id} to={`/eventos/${event.id}`} className="block">
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-text">{event.birthday_profile?.display_name || "Evento"}</p>
                    <p className="text-sm text-text-muted">{event.groups?.name}</p>
                    <p className="text-sm text-text-muted">{formatDate(event.birthday_date)}</p>
                  </div>
                  <StatusBadge status={event.status}>{event.status}</StatusBadge>
                </div>
                <p className="text-sm text-text-muted">Tu rol: {event.participant_role}</p>
              </Card>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
