import React, { useState } from "react";
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
import {
  getMyProfile,
  getProfileById,
  listPaymentDestinations,
  uploadAvatar,
  upsertProfile
} from "../service";
import { listMyWishlist } from "../../wishlist/service";
import { formatBirthday, formatCurrency } from "../../../utils/format";
import { cn } from "../../../utils/cn";

const INFO_TILES = [
  { key: "birthday", icon: "cake", label: "Cumpleaños", href: "/setup" },
  { key: "wishlist", icon: "card_giftcard", label: "Wishlist", href: "/wishlist" }
];

function ChipList({ items, color = "primary" }) {
  if (!items?.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "inline-block rounded-full px-3 py-1 text-xs font-bold",
            color === "primary" && "bg-primary/10 text-primary-strong",
            color === "danger" && "bg-danger/10 text-danger",
            color === "success" && "bg-success/10 text-success"
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

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
    queryFn: () => isOwnProfile ? getMyProfile(effectiveUserId) : getProfileById(effectiveUserId),
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
    enabled: Boolean(isOwnProfile && effectiveUserId && isSupabaseConfigured)
  });

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => navigate("/login", { replace: true })
  });

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      await upsertProfile(user.id, { avatar_url: url });
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Foto actualizada");
    } catch {
      toast.error("Error al actualizar foto");
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) {
    return <LoadingState message="Cargando perfil..." fullScreen />;
  }

  if (
    profileQuery.isLoading ||
    wishlistQuery.isLoading ||
    (isOwnProfile && paymentQuery.isLoading)
  ) {
    return <LoadingState message="Cargando tu perfil..." fullScreen />;
  }

  if (
    profileQuery.error ||
    wishlistQuery.error ||
    (isOwnProfile && paymentQuery.error)
  ) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tu perfil"
          description={profileQuery.error?.message || wishlistQuery.error?.message || paymentQuery.error?.message}
          onRetry={() => {
            profileQuery.refetch();
            wishlistQuery.refetch();
            if (isOwnProfile) {
              paymentQuery.refetch();
            }
          }}
        />
      </div>
    );
  }

  const profile = profileQuery.data;
  const wishlistItems = wishlistQuery.data || [];
  const paymentDestinations = isOwnProfile ? (paymentQuery.data || []) : [];
  const displayName = profile?.display_name || user.user_metadata?.display_name || user.email;

  const hasSizes = profile?.shirt_size || profile?.shoe_size || profile?.pants_size || profile?.clothing_styles?.length;
  const hasPreferences = profile?.favorite_colors?.length || profile?.favorite_brands?.length || profile?.hobbies?.length;
  const hasDietary = profile?.dietary_restrictions?.length;
  const hasDislikes = profile?.dislikes?.length;

  const infoValues = {
    birthday: profile ? formatBirthday(profile.birthday_day, profile.birthday_month) : "Sin capturar",
    wishlist: `${wishlistItems.length} ${wishlistItems.length === 1 ? "artículo" : "artículos"}`
  };

  return (
    <AppShell
      activeTab="perfil"
      header={<PageHeader title={isOwnProfile ? "Mi perfil" : "Perfil"} backTo={isOwnProfile ? null : "/inicio"} />}
    >
      <div className="space-y-6 pt-4">
        <div className="mx-[-0.5rem] flex flex-col items-center gap-4 rounded-[3rem] bg-gradient-to-b from-primary/10 to-transparent px-4 py-4">
          <div className="relative">
            <Avatar
              name={displayName}
              url={profile?.avatar_url}
              className="size-28 text-2xl shadow-xl ring-offset-4 ring-offset-bg"
              ring
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/60 p-[3px]">
                <div className="flex size-full items-center justify-center rounded-full bg-slate-900/40">
                  <span className="material-symbols-outlined animate-spin text-white">sync</span>
                </div>
              </div>
            )}
            {isOwnProfile && (
              <label className="absolute -bottom-1 -right-1 flex size-10 cursor-pointer items-center justify-center rounded-2xl bg-primary text-slate-950 shadow-float transition-all hover:scale-110 active:scale-95">
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={isUploading} />
                <span className="material-symbols-outlined text-[1.25rem]">photo_camera</span>
              </label>
            )}
          </div>

          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-black tracking-tight text-text">{displayName}</h2>
            {isOwnProfile ? (
              <p className="text-sm font-medium text-text-muted">{user.email}</p>
            ) : (
              <p className="text-sm font-medium text-text-muted">
                Perfil compartido contigo por un grupo en común
              </p>
            )}
          </div>
        </div>

        {isOwnProfile && (
          <section className="space-y-3">
            <div className="px-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Tu info</p>
              <p className="text-sm text-text-muted">
                Lo que ya tienes listo para que tus grupos te entiendan rápido.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {INFO_TILES.map((item) => (
                <Link key={item.key} to={item.href}>
                  <Card className="space-y-3 p-4 transition-all active:scale-[0.99]">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12">
                      <span className="material-symbols-outlined text-[1.2rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {item.icon}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-text">{item.label}</p>
                      <p className="text-xs leading-relaxed text-text-muted">
                        {infoValues[item.key]}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!isOwnProfile && profile?.birthday_day && (
          <Card className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">cake</span>
              <span className="text-sm font-bold text-text-muted">Cumpleaños</span>
            </div>
            <span className="text-sm font-black text-text">
              {formatBirthday(profile.birthday_day, profile.birthday_month)}
            </span>
          </Card>
        )}

        {(hasSizes || hasPreferences || hasDietary || hasDislikes) && (
          <section className="space-y-3 px-1">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">
                {isOwnProfile ? "Preferencias compartidas" : "Pistas útiles"}
              </p>
              <p className="text-sm text-text-muted">
                {isOwnProfile
                  ? "Así te ven tus cómplices cuando preparan algo para ti."
                  : "Esto ayuda a no improvisar regalos, tallas o alimentos."}
              </p>
            </div>

            {hasSizes && (
              <Card className="space-y-3 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Tallas</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  {profile.shirt_size && <span className="font-semibold text-text">Camisa: <span className="text-primary-strong">{profile.shirt_size}</span></span>}
                  {profile.shoe_size && <span className="font-semibold text-text">Zapato: <span className="text-primary-strong">{profile.shoe_size}</span></span>}
                  {profile.pants_size && <span className="font-semibold text-text">Pantalón: <span className="text-primary-strong">{profile.pants_size}</span></span>}
                  {profile.clothing_styles?.length > 0 && <span className="font-semibold text-text">Estilo: <span className="capitalize text-primary-strong">{profile.clothing_styles.join(", ")}</span></span>}
                </div>
              </Card>
            )}

            {hasPreferences && (
              <Card className="space-y-3 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Gustos e intereses</p>
                {profile.favorite_colors?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-bold text-text-muted">Colores</p>
                    <ChipList items={profile.favorite_colors} />
                  </div>
                )}
                {profile.favorite_brands?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-bold text-text-muted">Marcas</p>
                    <ChipList items={profile.favorite_brands} />
                  </div>
                )}
                {profile.hobbies?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-bold text-text-muted">Intereses</p>
                    <ChipList items={profile.hobbies} />
                  </div>
                )}
              </Card>
            )}

            {hasDietary && (
              <Card className="space-y-2 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Restricciones alimentarias</p>
                <ChipList items={profile.dietary_restrictions} color="success" />
              </Card>
            )}

            {hasDislikes && (
              <Card className="space-y-2 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">No quiero recibir</p>
                <ChipList items={profile.dislikes} color="danger" />
              </Card>
            )}
          </section>
        )}

        <section className="space-y-4 px-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-[1.25rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
                card_giftcard
              </span>
              <h3 className="text-sm font-black uppercase tracking-[0.15em]">Wishlist</h3>
            </div>
            <span className="rounded-full border border-border/50 bg-surface px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-text-muted/60">
              {wishlistItems.length} artículos
            </span>
          </div>

          {wishlistItems.length === 0 ? (
            <Card className="rounded-[2.5rem] border-dashed p-8 text-center">
              <p className="text-sm italic text-text-muted">Aún no hay artículos en esta lista.</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {wishlistItems.map((item) => (
                <Card key={item.id} className="space-y-3 border-none bg-surface/50 p-4 shadow-sm transition-all hover:ring-2 hover:ring-primary/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-text">{item.title}</p>
                      {item.notes && (
                        <p className="mt-0.5 line-clamp-2 text-xs italic leading-relaxed text-text-muted">
                          "{item.notes}"
                        </p>
                      )}
                    </div>

                    {item.price_estimate && (
                      <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-black text-primary">
                        {formatCurrency(item.price_estimate)}
                      </span>
                    )}
                  </div>

                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-fit items-center gap-2 rounded-xl bg-primary/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-primary transition-all hover:bg-primary hover:text-slate-950 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[1rem]">link</span>
                      Ver producto
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {isOwnProfile && (
          <section className="space-y-3">
            <div className="px-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Ajustes y finanzas</p>
              <p className="text-sm text-text-muted">
                Lo privado queda aquí, fuera del flujo principal de tu perfil compartido.
              </p>
            </div>

            <Link
              to="/perfil/metodos"
              className="flex items-center gap-4 rounded-[1.75rem] border border-primary/5 bg-surface px-5 py-4 shadow-sm transition-all hover:border-primary/20 active:scale-[0.98]"
            >
              <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/12">
                <span className="material-symbols-outlined text-[1.25rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  payments
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black uppercase tracking-tight text-text">Métodos de reembolso</p>
                <p className="text-xs font-bold text-text-muted/60">
                  {paymentDestinations.length} configurado{paymentDestinations.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="material-symbols-outlined text-[1.1rem] text-text-muted/40">chevron_right</span>
            </Link>

            <Button variant="secondary" size="lg" className="w-full" onClick={() => signOutMutation.mutate()}>
              {signOutMutation.isPending ? "Saliendo..." : "Cerrar sesión"}
            </Button>
          </section>
        )}
      </div>
    </AppShell>
  );
}
