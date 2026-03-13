import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Avatar } from "../../../components/ui/Avatar";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useAuth } from "../../auth/AuthContext";
import { createEvent } from "../../events/service";
import { createGroupInvite, getGroupDetail } from "../service";
import { formatBirthday, formatDate } from "../../../utils/format";

export function GroupDetailPage() {
  const { groupId } = useParams();
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [selectedBirthdayUser, setSelectedBirthdayUser] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [serverError, setServerError] = useState("");
  const detailQuery = useQuery({
    queryKey: ["group-detail", groupId],
    queryFn: () => getGroupDetail(groupId),
    enabled: Boolean(groupId && isSupabaseConfigured)
  });
  const inviteMutation = useMutation({
    mutationFn: () => createGroupInvite(groupId, user.id),
    onSuccess: (invite) => {
      setInviteUrl(`${window.location.origin}/join/${invite.token}`);
    },
    onError: (error) => setServerError(error.message)
  });
  const eventMutation = useMutation({
    mutationFn: () => createEvent(groupId, selectedBirthdayUser),
    onSuccess: async () => {
      setSelectedBirthdayUser("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["group-detail", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["events", user.id] })
      ]);
    },
    onError: (error) => setServerError(error.message)
  });

  const membersWithBirthday = useMemo(
    () => (detailQuery.data?.members || []).filter((member) => member.profiles?.birthday_day && member.profiles?.birthday_month),
    [detailQuery.data?.members]
  );

  if (detailQuery.isLoading) {
    return <LoadingState message="Cargando grupo..." fullScreen />;
  }

  if (detailQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar este grupo"
          description={detailQuery.error.message}
          onRetry={detailQuery.refetch}
        />
      </div>
    );
  }

  const { group, members, events } = detailQuery.data;

  return (
    <AppShell
      activeTab="grupos"
      header={<PageHeader title={group.name} subtitle="Grupo" backTo="/grupos" />}
    >
      <div className="space-y-4 pt-4">
        <Card className="space-y-4">
          <div>
            <p className="text-sm text-text-muted">Anticipacion automatica: {group.auto_create_days_before} dias</p>
            <p className="text-sm text-text-muted">Miembros: {members.length}</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Button variant="secondary" onClick={() => inviteMutation.mutate()}>
              {inviteMutation.isPending ? "Generando link..." : "Generar link de invitacion"}
            </Button>
            {inviteUrl ? (
              <div className="rounded-2xl bg-surface-muted px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Link de invitacion</p>
                <p className="mt-2 break-all text-sm text-text">{inviteUrl}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-text">Crear evento secreto manual</h2>
            <p className="text-sm text-text-muted">Solo puedes crearlo para alguien distinto a ti y que ya tenga cumpleanos registrado.</p>
          </div>
          <Select value={selectedBirthdayUser} onChange={(event) => setSelectedBirthdayUser(event.target.value)}>
            <option value="">Selecciona a la persona del cumpleanos</option>
            {membersWithBirthday
              .filter((member) => member.user_id !== user?.id)
              .map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.profiles?.display_name} · {formatBirthday(member.profiles?.birthday_day, member.profiles?.birthday_month)}
                </option>
              ))}
          </Select>
          {serverError ? <p className="text-sm font-medium text-danger">{serverError}</p> : null}
          <Button className="w-full" onClick={() => eventMutation.mutate()} disabled={!selectedBirthdayUser || eventMutation.isPending}>
            {eventMutation.isPending ? "Creando evento..." : "Crear evento"}
          </Button>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold text-text">Miembros</h2>
          {members.map((member) => (
            <div key={member.user_id} className="flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={member.profiles?.display_name} url={member.profiles?.avatar_url} />
                <div>
                  <p className="text-sm font-semibold text-text">{member.profiles?.display_name || "Miembro"}</p>
                  <p className="text-sm text-text-muted">{formatBirthday(member.profiles?.birthday_day, member.profiles?.birthday_month)}</p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">{member.role}</span>
            </div>
          ))}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Eventos del grupo</h2>
            <span className="text-sm text-text-muted">{events.length}</span>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-text-muted">Aun no hay eventos secretos creados.</p>
          ) : (
            events.map((event) => (
              <Link key={event.id} to={`/eventos/${event.id}`} className="block rounded-2xl bg-surface-muted px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-text">{event.birthday_profile?.display_name || "Evento"}</p>
                    <p className="text-sm text-text-muted">{formatDate(event.birthday_date, { day: "numeric", month: "short" })}</p>
                  </div>
                  <span className="rounded-full bg-primary/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-strong">
                    {event.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}
