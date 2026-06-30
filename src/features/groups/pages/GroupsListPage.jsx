import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { AvatarStack } from "../../../components/ui/AvatarStack";
import { Input } from "../../../components/ui/Input";
import { FormField } from "../../../components/ui/FormField";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { useAuth } from "../../auth/AuthContext";
import { createGroup, listGroups } from "../service";
import { daysUntilBirthday, getBirthdayCountdownLabel } from "../../../utils/format";

const GROUP_COLORS = [
  "from-primary/20 to-primary/5",
  "from-success/20 to-success/5",
  "from-warning/20 to-warning/5",
  "from-danger/20 to-danger/5"
];

export function GroupsListPage() {
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const listQuery = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: () => listGroups(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });

  const createMutation = useMutation({
    mutationFn: (values) => createGroup(user.id, values),
    onSuccess: async () => {
      setName("");
      setShowCreate(false);
      toast.success("Grupo creado");
      await queryClient.invalidateQueries({ queryKey: ["groups", user.id] });
    },
    onError: (error) => toast.error(
      error.message.includes("row-level security policy")
        ? "Error de permisos. Corre el SQL 0003."
        : error.message
    )
  });

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Ingresa un nombre para el grupo.");
      return;
    }

    await createMutation.mutateAsync({ name: name.trim() });
  };

  if (listQuery.isLoading) {
    return <LoadingState message="Cargando grupos..." fullScreen />;
  }

  if (listQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tus grupos"
          description={listQuery.error.message}
          onRetry={listQuery.refetch}
        />
      </div>
    );
  }

  return (
    <AppShell
      activeTab="grupos"
      header={(
        <PageHeader
          title="Mis grupos"
          subtitle={`${listQuery.data.length} espacio${listQuery.data.length === 1 ? "" : "s"} activo${listQuery.data.length === 1 ? "" : "s"}`}
          action={(
            <Button
              size="sm"
              className="h-9 rounded-full px-4 text-[10px] font-black uppercase tracking-widest shadow-float"
              onClick={() => setShowCreate(true)}
            >
              Crear
            </Button>
          )}
        />
      )}
      hideNav={showCreate}
    >
      <div className="space-y-4 pt-4">
        {listQuery.data.length === 0 ? (
          <EmptyState
            icon="groups"
            title="Aún no tienes grupos"
            description="Crea el primero y comparte un link para que todos entren rápido."
            actionLabel="Crear grupo"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <>
            {listQuery.data.map((group, index) => {
              const members = group.members || [];
              const nextBirthday = members
                .filter((member) => member.profiles?.birthday_day && member.user_id !== user.id)
                .map((member) => ({
                  ...member.profiles,
                  days: daysUntilBirthday(member.profiles.birthday_day, member.profiles.birthday_month)
                }))
                .filter((member) => member.days !== null)
                .sort((a, b) => a.days - b.days)[0];

              return (
                <Link key={group.id} to={`/grupos/${group.id}`} className="block">
                  <Card className="space-y-4 p-4 transition-all active:scale-[0.99]">
                    <div className="flex items-start gap-3">
                      <div className={`flex size-12 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-gradient-to-br ${GROUP_COLORS[index % GROUP_COLORS.length]}`}>
                        <span
                          className="material-symbols-outlined text-[1.6rem] text-primary"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          groups
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-black text-text">
                              {group.name}
                            </p>
                            <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted">
                              {members.length} cómplice{members.length === 1 ? "" : "s"}
                            </p>
                          </div>

                          <AvatarStack
                            users={members.map((member) => ({
                              name: member.profiles?.display_name,
                              avatar_url: member.profiles?.avatar_url
                            }))}
                            max={4}
                          />
                        </div>

                        {nextBirthday ? (
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted/70 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
                                Próximo cumpleaños
                              </p>
                              <p className="truncate text-sm font-bold text-text">
                                {nextBirthday.display_name?.split(" ")[0]}
                              </p>
                            </div>
                            <span className="rounded-full bg-primary/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-primary-strong">
                              {getBirthdayCountdownLabel(nextBirthday.days)}
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border px-3 py-2">
                            <p className="text-sm text-text-muted">
                              Aún no hay cumpleaños visibles en este grupo.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/60 pt-3">
                      <span className="text-xs font-bold text-text-muted">
                        Entra para ver eventos, intercambios e invitaciones
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.15em] text-primary">
                        Ver grupo
                        <span className="material-symbols-outlined text-[1rem]">chevron_right</span>
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}

            <Button
              variant="secondary"
              size="pill"
              className="mt-2 w-full"
              onClick={() => setShowCreate(true)}
            >
              Crear otro grupo
            </Button>
          </>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[28rem] rounded-[2rem] bg-bg p-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-text">Crear grupo</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-text-muted transition-colors hover:text-text"
              >
                <span className="material-symbols-outlined text-[1.25rem]">close</span>
              </button>
            </div>

            <p className="mb-6 text-sm leading-relaxed text-text-muted">
              Crea un grupo para familia, amigos o trabajo y comparte un link para empezar a planear.
            </p>

            <form className="space-y-6" onSubmit={handleCreate}>
              <FormField label="Nombre del grupo">
                <Input
                  placeholder="Ej. Amigos de la uni"
                  value={name}
                  autoFocus
                  className="h-14 text-base"
                  onChange={(event) => setName(event.target.value)}
                />
              </FormField>

              <Button
                type="submit"
                size="pill"
                className="w-full"
                disabled={!isSupabaseConfigured || createMutation.isPending}
              >
                {createMutation.isPending ? "Creando grupo..." : "Crear grupo"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
