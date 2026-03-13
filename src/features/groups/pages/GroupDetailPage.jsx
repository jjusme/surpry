import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
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
import { cn } from "../../../utils/cn";

export function GroupDetailPage() {
  const { groupId } = useParams();
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [selectedBirthdayUser, setSelectedBirthdayUser] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["group-detail", groupId],
    queryFn: () => getGroupDetail(groupId),
    enabled: Boolean(groupId && isSupabaseConfigured)
  });

  const inviteMutation = useMutation({
    mutationFn: () => createGroupInvite(groupId, user.id),
    onSuccess: (invite) => {
      setInviteUrl(`${window.location.origin}/join/${invite.token}`);
      toast.success("Link generado");
    },
    onError: (error) => toast.error(error.message)
  });

  const eventMutation = useMutation({
    mutationFn: () => createEvent(groupId, selectedBirthdayUser),
    onSuccess: async () => {
      setSelectedBirthdayUser("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["group-detail", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["events", user.id] })
      ]);
      toast.success("Plan sorpresa iniciado");
    },
    onError: (error) => toast.error(error.message)
  });

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const membersWithBirthday = useMemo(
    () =>
      (detailQuery.data?.members || []).filter(
        (m) => m.profiles?.birthday_day && m.profiles?.birthday_month
      ),
    [detailQuery.data?.members]
  );

  if (detailQuery.isLoading) return <LoadingState message="Cargando grupo..." fullScreen />;
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
      header={<PageHeader title="Detalles del grupo" backTo="/grupos" />}
    >
      <div className="space-y-5 pt-4">
        {/* Group hero */}
        <div className="flex flex-col items-center gap-3 py-4 text-center animate-in fade-in zoom-in duration-500">
          <div className="flex size-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-primary/30 to-primary/10 shadow-float ring-4 ring-bg">
            <span
              className="material-symbols-outlined text-[3rem] text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              groups_3
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-text">{group.name}</h1>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <span className="material-symbols-outlined text-[0.9rem]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              {members.length} Cómplice{members.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="w-full mt-2">
            {!inviteUrl ? (
              <Button
                size="pill"
                className="gap-2 w-full transition-all active:scale-95"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
              >
                <span className="material-symbols-outlined text-[1.15rem]">add_link</span>
                {inviteMutation.isPending ? "Generando link..." : "Sumar cómplices"}
              </Button>
            ) : (
              <div className="relative group overflow-hidden rounded-[1.5rem] bg-surface-muted border border-border/50 p-1.5 flex items-center transition-all hover:border-primary/30 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex-1 px-4 text-left overflow-hidden">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/60 mb-0.5">Link de Invitación</p>
                  <p className="text-sm font-medium text-text truncate pr-4">
                    {inviteUrl.replace(/^https?:\/\//, "")}
                  </p>
                </div>
                <button
                  onClick={handleCopyInvite}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-2xl transition-all duration-300 active:scale-90",
                    copySuccess ? "bg-success text-white" : "bg-primary text-slate-950 hover:bg-primary-strong"
                  )}
                >
                  <span className="material-symbols-outlined text-[1.25rem]">
                    {copySuccess ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active missions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black tracking-tight text-text">Planes activos</h2>
              <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-danger">
                TOP SECRET
              </span>
            </div>
          </div>

          {membersWithBirthday.filter((m) => m.user_id !== user?.id).length > 0 && (
            <Card className="space-y-5 border-l-4 border-primary p-5 shadow-sm">
              <div>
                <p className="text-base font-bold text-text">Inicia un plan sorpresa</p>
                <p className="text-sm text-text-muted leading-relaxed">
                  Solo los cómplices verán esto. El festejado no recibirá ninguna notificación.
                </p>
              </div>
              <div className="space-y-4">
                <Select
                  className="bg-bg/50"
                  value={selectedBirthdayUser}
                  onChange={(e) => setSelectedBirthdayUser(e.target.value)}
                >
                  <option value="">¿A quién celebramos?</option>
                  {membersWithBirthday
                    .filter((m) => m.user_id !== user?.id)
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profiles?.display_name} ·{" "}
                        {formatBirthday(m.profiles?.birthday_day, m.profiles?.birthday_month)}
                      </option>
                    ))}
                </Select>
                <Button
                  size="pill"
                  className="w-full h-12 text-base font-bold"
                  onClick={() => eventMutation.mutate()}
                  disabled={!selectedBirthdayUser || eventMutation.isPending}
                >
                  {eventMutation.isPending ? "Preparando todo..." : "Iniciar sorpresa"}
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="rounded-[1.5rem] bg-surface-muted/50 border border-dashed border-border p-8 text-center space-y-2">
                <span className="material-symbols-outlined text-text-muted/30 text-4xl">inventory_2</span>
                <p className="text-sm text-text-muted font-medium">
                  No hay planes activos en este grupo.
                </p>
              </div>
            ) : (
              events.map((event) => (
                <Link key={event.id} to={`/eventos/${event.id}`} className="block group">
                  <div className="flex items-center gap-4 rounded-[1.5rem] bg-surface p-4 shadow-sm border border-transparent transition-all hover:border-primary/20 active:scale-[0.98]">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <span
                        className="material-symbols-outlined text-[1.4rem] text-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        celebration
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-0.5">Festejado</p>
                      <p className="text-lg font-black text-text truncate capitalize">
                        {event.birthday_profile?.display_name || "Desconocido"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="material-symbols-outlined text-[1rem] text-primary">calendar_today</span>
                        <p className="text-xs font-bold text-text-muted">
                          {formatDate(event.birthday_date, { day: "numeric", month: "long" })}
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-text-muted/40 font-light">chevron_right</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Members list */}
        <div className="space-y-4 pt-4 pb-12">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-black tracking-tight text-text">Tu círculo de cómplices</h2>
            <span className="text-xs font-bold text-text-muted">{members.length} activos</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between rounded-2xl bg-surface/50 border border-border/40 px-4 py-3 transition-colors hover:bg-surface"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    className="size-10 ring-2 ring-bg"
                    name={member.profiles?.display_name}
                    url={member.profiles?.avatar_url}
                  />
                  <div>
                    <p className="text-sm font-bold text-text flex items-center gap-2">
                      {member.profiles?.display_name || "Anónimo"}
                      {member.user_id === user?.id && (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">Tú</span>
                      )}
                    </p>
                    <p className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                      <span className="material-symbols-outlined text-[0.9rem] opacity-50">cake</span>
                      {formatBirthday(
                        member.profiles?.birthday_day,
                        member.profiles?.birthday_month
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider",
                    member.role === 'admin' ? "bg-primary/10 text-primary" : "bg-surface-muted text-text-muted"
                  )}>
                    {member.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
