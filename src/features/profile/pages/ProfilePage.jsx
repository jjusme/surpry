import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Avatar } from "../../../components/ui/Avatar";
import { Card } from "../../../components/ui/Card";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useAuth } from "../../auth/AuthContext";
import { signOut } from "../../auth/api";
import { getMyProfile, listPaymentDestinations, uploadAvatar, upsertProfile } from "../service";
import { listMyWishlist } from "../../wishlist/service";
import { formatBirthday } from "../../../utils/format";
import { cn } from "../../../utils/cn";
import { useState } from "react";

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
  const { userId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const effectiveUserId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;

  const profileQuery = useQuery({
    queryKey: ["profile", effectiveUserId],
    queryFn: () => getMyProfile(effectiveUserId),
    enabled: Boolean(effectiveUserId && isSupabaseConfigured)
  });
  const wishlistQuery = useQuery({
    queryKey: ["wishlist", effectiveUserId],
    queryFn: () => listMyWishlist(effectiveUserId),
    enabled: Boolean(effectiveUserId && isSupabaseConfigured)
  });
  const paymentQuery = useQuery({
    queryKey: ["payment-destinations", effectiveUserId],
    queryFn: () => listPaymentDestinations(effectiveUserId),
    enabled: Boolean(effectiveUserId && isSupabaseConfigured)
  });
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => navigate("/login", { replace: true })
  });

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      await upsertProfile(user.id, { avatar_url: url });
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Foto actualizada");
    } catch (error) {
      toast.error("Error al actualizar foto");
    } finally {
      setIsUploading(false);
    }
  };

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
          title={isOwnProfile ? "Mi Perfil" : "Perfil"}
          backTo={isOwnProfile ? null : "/inicio"}
        />
      }
    >
      <div className="space-y-6 pt-4">
        {/* Profile hero */}
        <div className="flex flex-col items-center gap-4 py-4 px-4 bg-gradient-to-b from-primary/10 to-transparent rounded-[3rem] -mx-2">
          <div className="relative">
            <Avatar
              name={displayName}
              url={profile?.avatar_url}
              className="size-28 text-2xl shadow-xl ring-offset-4 ring-offset-bg"
              ring
            />
            {isUploading && (
              <div className="absolute inset-0 bg-slate-900/60 rounded-full flex items-center justify-center p-[3px]">
                <div className="size-full bg-slate-900/40 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white animate-spin">sync</span>
                </div>
              </div>
            )}
            {isOwnProfile && (
              <label className="absolute -bottom-1 -right-1 size-10 bg-primary text-slate-950 rounded-2xl flex items-center justify-center cursor-pointer shadow-float hover:scale-110 active:scale-95 transition-all">
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={isUploading} />
                <span className="material-symbols-outlined text-[1.25rem]">photo_camera</span>
              </label>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-text tracking-tight">{displayName}</h2>
            {isOwnProfile && <p className="text-sm font-medium text-text-muted">{user.email}</p>}
          </div>
        </div>

        {/* Public Profile Info */}
        {!isOwnProfile && profile?.birthday_day && (
          <div className="px-5 py-4 rounded-3xl bg-surface/50 border border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">cake</span>
              <span className="text-sm font-bold text-text-muted">Cumpleaños</span>
            </div>
            <span className="text-sm font-black text-text">
              {formatBirthday(profile.birthday_day, profile.birthday_month)}
            </span>
          </div>
        )}

        {/* Wishlist Section */}
        <div className="px-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined font-variation-fill text-[1.25rem]">card_giftcard</span>
              <h3 className="text-sm font-black uppercase tracking-[0.15em]">Lista de deseos</h3>
            </div>
            <span className="text-[10px] font-black text-text-muted/40 uppercase tracking-widest bg-surface px-2 py-0.5 rounded-full border border-border/50">
              {wishlistQuery.data?.length || 0} ARTÍCULOS
            </span>
          </div>

          {wishlistQuery.data?.length === 0 ? (
            <div className="p-8 text-center rounded-[2.5rem] bg-surface/30 border border-dashed border-border">
               <p className="text-sm text-text-muted italic">Aún no hay artículos en esta lista.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {wishlistQuery.data?.map(item => (
                <Card key={item.id} className="p-4 space-y-3 bg-white/40 border-none shadow-sm hover:ring-2 hover:ring-primary/20 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-text truncate">{item.title}</p>
                      {item.notes && <p className="text-xs text-text-muted italic mt-0.5 line-clamp-2 leading-relaxed">"{item.notes}"</p>}
                    </div>
                    {item.price_estimate && (
                      <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">
                        ${item.price_estimate}
                      </span>
                    )}
                  </div>
                  
                  {item.url && (
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 w-fit px-3 py-1.5 bg-primary/12 text-primary rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-primary hover:text-slate-950 transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[1rem]">link</span>
                      Ver producto
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Menu Items (Own Profile ONLY) */}
        {isOwnProfile && (
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
        )}

        {isOwnProfile && (
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => signOutMutation.mutate()}
          >
            {signOutMutation.isPending ? "Saliendo..." : "Cerrar sesión"}
          </Button>
        )}
      </div>
    </AppShell>
  );
}
