import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Avatar } from "../../../components/ui/Avatar";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useAuth } from "../../auth/AuthContext";
import { signOut } from "../../auth/api";
import { getMyProfile, listPaymentDestinations } from "../service";
import { listMyWishlist } from "../../wishlist/service";
import { formatBirthday } from "../../../utils/format";

const ROW_ITEMS = [
  {
    key: "birthday",
    icon: "cake",
    label: "Cumpleaños",
    section: "INFORMACIÓN",
    href: "/onboarding"
  },
  {
    key: "wishlist",
    icon: "card_giftcard",
    label: "Mi wishlist",
    section: "INFORMACIÓN",
    href: "/wishlist"
  },
  {
    key: "payments",
    icon: "payments",
    label: "Métodos de reembolso",
    section: "FINANZAS",
    href: "/perfil/metodos"
  }
];

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

  if (!user) return <LoadingState message="Cargando perfil..." fullScreen />;

  if (profileQuery.isLoading || wishlistQuery.isLoading || paymentQuery.isLoading) {
    return <LoadingState message="Cargando tu perfil..." fullScreen />;
  }

  if (profileQuery.error || wishlistQuery.error || paymentQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tu perfil"
          description={
            profileQuery.error?.message ||
            wishlistQuery.error?.message ||
            paymentQuery.error?.message
          }
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
  const displayName = profile?.display_name || user.user_metadata?.display_name || user.email;

  const getSublabel = (key) => {
    if (key === "birthday")
      return profile
        ? formatBirthday(profile.birthday_day, profile.birthday_month)
        : "Sin capturar";
    if (key === "wishlist") return `${wishlistQuery.data.length} artículo(s)`;
    if (key === "payments") return `${paymentQuery.data.length} configurado(s)`;
    return "";
  };

  return (
    <AppShell
      activeTab="perfil"
      header={
        <PageHeader
          title="Perfil"
        />
      }
    >
      <div className="space-y-6 pt-4">
        {/* Profile hero */}
        <div className="flex flex-col items-center gap-4 py-4 px-4 bg-gradient-to-b from-primary/10 to-transparent rounded-[3rem] -mx-2">
          <Avatar
            name={displayName}
            url={profile?.avatar_url}
            className="size-28 text-2xl shadow-xl ring-offset-4 ring-offset-bg"
            ring
            badge={
              <button
                onClick={() => navigate("/onboarding")}
                className="flex size-10 items-center justify-center rounded-full bg-slate-950 text-white shadow-float active:scale-90 transition-transform"
              >
                <span
                  className="material-symbols-outlined text-[1.1rem]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  edit
                </span>
              </button>
            }
          />
          <div className="text-center">
            <h2 className="text-2xl font-black text-text tracking-tight">{displayName}</h2>
            <p className="text-sm font-medium text-text-muted">{user.email}</p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-3">
          {ROW_ITEMS.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className="flex items-center gap-4 rounded-[1.75rem] bg-white px-5 py-4 shadow-sm border border-primary/5 hover:border-primary/20 transition-all active:scale-[0.98]"
            >
              <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/12">
                <span
                  className="material-symbols-outlined text-[1.25rem] text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {item.icon}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-text uppercase tracking-tight">{item.label}</p>
                <p className="text-xs font-bold text-text-muted/60">{getSublabel(item.key)}</p>
              </div>
              <span className="material-symbols-outlined text-[1.1rem] text-text-muted/40">
                chevron_right
              </span>
            </Link>
          ))}
        </div>

        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => signOutMutation.mutate()}
        >
          {signOutMutation.isPending ? "Saliendo..." : "Cerrar sesión"}
        </Button>
      </div>
    </AppShell>
  );
}
