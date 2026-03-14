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
        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar
            name={displayName}
            url={profile?.avatar_url}
            className="size-28 text-2xl"
            ring
            badge={
              <button
                onClick={() => navigate("/onboarding")}
                className="flex size-9 items-center justify-center rounded-full bg-primary shadow-float"
              >
                <span
                  className="material-symbols-outlined text-[1rem] text-slate-950"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  edit
                </span>
              </button>
            }
          />
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-text">{displayName}</h2>
            <p className="text-sm text-text-muted">{user.email}</p>
          </div>
        </div>

        {/* Info section */}
        <div className="space-y-2">
          <p className="px-1 text-xs font-black uppercase tracking-[0.2em] text-text-muted">
            Información
          </p>
          {ROW_ITEMS.filter((it) => it.section === "INFORMACIÓN").map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-card"
            >
              <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/12">
                <span
                  className="material-symbols-outlined text-[1.2rem] text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {item.icon}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{item.label}</p>
                <p className="text-sm text-text-muted">{getSublabel(item.key)}</p>
              </div>
              <span className="material-symbols-outlined text-[1.1rem] text-text-muted">
                chevron_right
              </span>
            </Link>
          ))}
        </div>

        {/* Finance section */}
        <div className="space-y-2">
          <p className="px-1 text-xs font-black uppercase tracking-[0.2em] text-text-muted">
            Finanzas
          </p>
          {ROW_ITEMS.filter((it) => it.section === "FINANZAS").map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-card"
            >
              <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/12">
                <span
                  className="material-symbols-outlined text-[1.2rem] text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {item.icon}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{item.label}</p>
                <p className="text-sm text-text-muted">{getSublabel(item.key)}</p>
              </div>
              <span className="material-symbols-outlined text-[1.1rem] text-text-muted">
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
