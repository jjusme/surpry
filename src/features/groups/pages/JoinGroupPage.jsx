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
    return <LoadingState message="Validando invitacion..." fullScreen />;
  }

  if (inviteQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos validar esta invitacion"
          description={inviteQuery.error.message}
          onRetry={inviteQuery.refetch}
        />
      </div>
    );
  }

  return (
    <AppShell hideNav header={<PageHeader title="Invitacion" subtitle="Grupo" />}>
      <div className="space-y-4 pt-6">
        <Card className="space-y-4 text-center">
          <div>
            <h2 className="text-2xl font-bold text-text">{inviteQuery.data?.groups?.name || "Invitacion de grupo"}</h2>
            <p className="mt-2 text-sm text-text-muted">
              Usa este link para unirte al grupo y empezar a coordinar eventos secretos.
            </p>
          </div>
          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">Necesitas iniciar sesion para aceptar la invitacion.</p>
              <Link to="/login">
                <Button className="w-full">Ir a login</Button>
              </Link>
            </div>
          ) : (
            <Button className="w-full" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? "Uniendote..." : "Unirme al grupo"}
            </Button>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
