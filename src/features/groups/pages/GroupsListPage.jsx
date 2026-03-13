import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { FormField } from "../../../components/ui/FormField";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { useAuth } from "../../auth/AuthContext";
import { createGroup, listGroups } from "../service";

export function GroupsListPage() {
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [name, setName] = useState("");
  const [serverError, setServerError] = useState("");
  const listQuery = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: () => listGroups(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const createMutation = useMutation({
    mutationFn: (values) => createGroup(user.id, values),
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["groups", user.id] });
    },
    onError: (error) => setServerError(error.message)
  });

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setServerError("Ingresa un nombre para el grupo.");
      return;
    }

    setServerError("");
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
      header={<PageHeader title="Grupos" subtitle="Tus circulos" />}
    >
      <div className="space-y-4 pt-4">
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-text">Crear grupo</h2>
            <p className="text-sm text-text-muted">Crea un grupo para familia, amigos o trabajo y luego comparte un link de invitacion.</p>
          </div>
          <form className="space-y-4" onSubmit={handleCreate}>
            <FormField label="Nombre del grupo">
              <Input placeholder="Ej. Amigos de la uni" value={name} onChange={(event) => setName(event.target.value)} />
            </FormField>
            {serverError ? <p className="text-sm font-medium text-danger">{serverError}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={!isSupabaseConfigured || createMutation.isPending}>
              {createMutation.isPending ? "Creando..." : "Crear grupo"}
            </Button>
          </form>
        </Card>

        {listQuery.data.length === 0 ? (
          <EmptyState
            icon="groups"
            title="Aun no tienes grupos"
            description="Crea el primero y despues invita a los demas por link."
          />
        ) : (
          listQuery.data.map((group) => (
            <Link key={group.id} to={`/grupos/${group.id}`} className="block">
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-text">{group.name}</p>
                    <p className="text-sm text-text-muted">Rol: {group.membership_role}</p>
                  </div>
                  <span className="rounded-full bg-primary/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-strong">
                    {group.auto_create_days_before} dias
                  </span>
                </div>
                <p className="text-sm text-text-muted">Anticipacion automatica para crear eventos secretos.</p>
              </Card>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
