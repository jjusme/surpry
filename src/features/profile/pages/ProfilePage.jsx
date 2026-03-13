import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Avatar } from "../../../components/ui/Avatar";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useAuth } from "../../auth/AuthContext";
import { signOut } from "../../auth/api";
import { getMyProfile, listPaymentDestinations } from "../service";
import { listMyWishlist } from "../../wishlist/service";
import { formatBirthday } from "../../../utils/format";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, isSupabaseConfigured } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getMyProfile(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const wishlistQuery = useQuery({
    queryKey: ["wishlist", user?.id],
    queryFn: () => listMyWishlist(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const paymentQuery = useQuery({
    queryKey: ["payment-destinations", user?.id],
    queryFn: () => listPaymentDestinations(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => navigate("/login", { replace: true })
  });

  if (!user) {
    return <LoadingState message="Cargando perfil..." fullScreen />;
  }

  if (profileQuery.isLoading || wishlistQuery.isLoading || paymentQuery.isLoading) {
    return <LoadingState message="Cargando tu perfil..." fullScreen />;
  }

  if (profileQuery.error || wishlistQuery.error || paymentQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tu perfil"
          description={profileQuery.error?.message || wishlistQuery.error?.message || paymentQuery.error?.message}
          onRetry={() => {
            profileQuery.refetch();
            wishlistQuery.refetch();
            paymentQuery.refetch();
          }}
        />
      </div>
    );
  }

  const profile = profileQuery.data;

  return (
    <AppShell
      activeTab="perfil"
      header={<PageHeader title="Perfil" subtitle="Tu espacio" />}
    >
      <div className="space-y-4 pt-4">
        <Card className="flex flex-col items-center gap-4 p-6 text-center">
          <Avatar name={profile?.display_name || user.email} url={profile?.avatar_url} className="size-24 text-xl" />
          <div>
            <h2 className="text-2xl font-bold text-text">
              {profile?.display_name || user.user_metadata?.display_name || user.email}
            </h2>
            <p className="text-sm text-text-muted">{user.email}</p>
          </div>
          <Button variant="secondary" onClick={() => navigate("/onboarding")}>
            Editar perfil
          </Button>
        </Card>

        <Card className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Informacion</p>
          <div className="flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text">Cumpleanos</p>
              <p className="text-sm text-text-muted">
                {profile ? formatBirthday(profile.birthday_day, profile.birthday_month) : "Sin capturar"}
              </p>
            </div>
            <Button variant="ghost" size="md" onClick={() => navigate("/onboarding")}>Editar</Button>
          </div>
          <Link to="/wishlist" className="flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text">Mi wishlist</p>
              <p className="text-sm text-text-muted">{wishlistQuery.data.length} item(s)</p>
            </div>
            <span className="material-symbols-outlined text-text-muted">chevron_right</span>
          </Link>
          <Link to="/perfil/metodos" className="flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text">Metodos de reembolso</p>
              <p className="text-sm text-text-muted">{paymentQuery.data.length} configurado(s)</p>
            </div>
            <span className="material-symbols-outlined text-text-muted">chevron_right</span>
          </Link>
        </Card>

        <Button variant="secondary" className="w-full" onClick={() => signOutMutation.mutate()}>
          {signOutMutation.isPending ? "Saliendo..." : "Cerrar sesion"}
        </Button>
      </div>
    </AppShell>
  );
}
