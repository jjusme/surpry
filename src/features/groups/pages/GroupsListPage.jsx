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
      error.message.includes("row-level security policy") ? "Error de permisos. Corre el SQL 0003." : error.message
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

  if (listQuery.isLoading) return <LoadingState message="Cargando grupos..." fullScreen />;

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
      header={<PageHeader title="Mis Grupos" />}
      hideNav={showCreate} // Hide bottom nav when modal is open
    >
      <div className="space-y-4 pt-4">
        {listQuery.data.length === 0 ? (
          <EmptyState
            icon="groups"
            title="Aún no tienes grupos"
            description="Crea el primero y después invita a los demás por link."
          />
        ) : (
          listQuery.data.map((group, i) => {
            const members = group.members || [];
            const nextBirthday = members
              .filter((m) => m.profiles?.birthday_day && m.user_id !== user.id)
              .map((m) => ({
                ...m.profiles,
                days: (() => {
                  const today = new Date();
                  const year = today.getFullYear();
                  let next = new Date(year, m.profiles.birthday_month - 1, m.profiles.birthday_day);
                  if (next < today) next = new Date(year + 1, m.profiles.birthday_month - 1, m.profiles.birthday_day);
                  return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
                })()
              }))
              .sort((a, b) => a.days - b.days)[0];

            return (
              <Link key={group.id} to={`/grupos/${group.id}`} className="block">
                <Card className="overflow-hidden p-0">
                  {/* Color banner */}
                  <div
                    className={`h-24 w-full bg-gradient-to-br ${GROUP_COLORS[i % GROUP_COLORS.length]} flex items-center justify-center`}
                  >
                    <span
                      className="material-symbols-outlined text-[3rem] text-primary/40"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      groups
                    </span>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-text">{group.name}</p>
                        <p className="text-sm text-text-muted">
                          {members.length} cómplice{members.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <AvatarStack
                        users={members.map(m => ({ name: m.profiles?.display_name, avatar_url: m.profiles?.avatar_url }))}
                        max={4}
                      />
                    </div>

                    {nextBirthday && (
                      <div className="flex items-center gap-2 rounded-2xl bg-surface-muted px-3 py-2">
                        <span
                          className="material-symbols-outlined text-[1rem] text-primary"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          cake
                        </span>
                        <p className="text-xs font-semibold text-text-muted">
                          <span className="text-text">Próximo cumpleaños:</span>{" "}
                          {nextBirthday.display_name?.split(" ")[0]} en {nextBirthday.days}d
                        </p>
                        <Link
                          to={`/grupos/${group.id}`}
                          className="ml-auto text-xs font-bold text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Sorprender
                        </Link>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>

      {/* Create group modal overlay */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-[28rem] rounded-[2rem] bg-bg p-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-text">Crear grupo</h2>
              <button
                type="button"
                onClick={() => { setShowCreate(false); }}
                className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-text-muted hover:text-text transition-colors"
              >
                <span className="material-symbols-outlined text-[1.25rem]">close</span>
              </button>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-text-muted">
              Crea un grupo para familia, amigos o trabajo y comparte un link de invitación para empezar a planear.
            </p>
            <form className="space-y-6" onSubmit={handleCreate}>
              <FormField label="Nombre del grupo">
                <Input
                  placeholder="Ej. Amigos de la uni"
                  value={name}
                  autoFocus
                  className="h-14 text-base"
                  onChange={(e) => setName(e.target.value)}
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

      {/* FAB */}
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        className="fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary shadow-float transition-transform active:scale-95"
        style={{ maxRight: "calc(50% - 15rem + 1rem)" }}
      >
        <span className="material-symbols-outlined text-[1.5rem] text-slate-950">add</span>
      </button>
    </AppShell>
  );
}
