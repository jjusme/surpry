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
            title="Todavía no participas en eventos"
            description="Crea uno manualmente desde un grupo o espera a que se generen automáticamente."
          />
        ) : (
          listQuery.data.map((event) => (
            <Link key={event.id} to={`/eventos/${event.id}`} className="block transform active:scale-[0.99] transition-all">
              <Card className="p-3.5 rounded-2xl border-none shadow-sm hover:shadow-md transition-all bg-white flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-black text-text truncate leading-tight">
                    Cumple de {event.birthday_profile?.display_name?.split(" ")[0] || "Alguien"}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold text-text-muted/60">
                    <span className="truncate max-w-[120px]">{event.groups?.name || 'Privado'}</span>
                    <span className="opacity-40">•</span>
                    <span>{event.participants?.length || 0} {event.participants?.length === 1 ? 'Cómplice' : 'Cómplices'}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className="whitespace-nowrap scale-[0.85] origin-right">
                    <StatusBadge status={event.status} />
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
