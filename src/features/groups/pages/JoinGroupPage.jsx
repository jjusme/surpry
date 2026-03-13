import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useAuth } from "../../auth/AuthContext";
import { acceptInvite, getInviteByToken } from "../service";

export function JoinGroupPage() {
  const navigate = useNavigate();
  const { token } = useParams();
  const { user, isSupabaseConfigured } = useAuth();

  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInviteByToken(token),
    enabled: Boolean(token && isSupabaseConfigured)
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvite(token),
    onSuccess: (groupId) => navigate(`/grupos/${groupId}`, { replace: true })
  });

  if (inviteQuery.isLoading) {
    return <LoadingState message="Validando invitación..." fullScreen />;
  }

  if (inviteQuery.error || (inviteQuery.isSuccess && !inviteQuery.data)) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="Invitación caducada"
          description={inviteQuery.error?.message || "Este enlace ya no es válido o ha expirado."}
          onRetry={inviteQuery.refetch}
        />
      </div>
    );
  }

  const group = inviteQuery.data?.groups;

  return (
    <AppShell hideNav header={<PageHeader title="Invitación" subtitle="Plan Secreto" />}>
      <div className="space-y-6 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex size-20 items-center justify-center rounded-[1.75rem] bg-primary/15 shadow-float text-primary">
            <span className="material-symbols-outlined text-[2.5rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
              favorite
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Solicitud de Cómplice</p>
            <h1 className="text-3xl font-black tracking-tight text-text">
              {group?.name || "Grupo Sorpresa"}
            </h1>
          </div>
        </div>

        <Card className="p-6 text-center space-y-6 shadow-2xl border-t-4 border-primary">
          <p className="text-sm leading-relaxed text-text-muted px-2">
            Te han invitado a ser cómplice en este grupo para planear momentos especiales sin que nadie se entere antes de tiempo.
          </p>

          {!user ? (
            <div className="space-y-4 pt-2">
              <div className="rounded-2xl bg-surface-muted p-4 border border-border/50">
                <p className="text-xs font-bold text-text-muted">
                  Protocolo Surpry: Necesitas una cuenta de cómplice para continuar.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button asChild variant="secondary" size="lg">
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button asChild size="lg">
                  <Link to="/registro">Registrarme</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-success font-bold text-xs uppercase tracking-wider">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                Cómplice Identificado
              </div>
              <Button
                className="w-full h-14 text-lg font-black tracking-wide shadow-lg active:scale-95 transition-all"
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? "Procesando..." : "¡Sí, acepto!"}
              </Button>
            </div>
          )}
        </Card>

        <p className="text-center text-[10px] font-bold text-text-muted/40 uppercase tracking-[0.2em]">
          Surpry Secret Planning · Shhh!
        </p>
      </div>
    </AppShell>
  );
}
