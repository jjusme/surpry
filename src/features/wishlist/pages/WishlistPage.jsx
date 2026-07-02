import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { TextArea } from "../../../components/ui/TextArea";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { BottomSheet } from "../../../components/ui/BottomSheet";
import { NotificationBell } from "../../../components/ui/NotificationBell";
import { useAuth } from "../../auth/AuthContext";
import { deleteWishlistItem, listMyWishlist, saveWishlistItem, toggleFulfilled } from "../service";
import { formatCurrency } from "../../../utils/format";
import { cn } from "../../../utils/cn";

const CATEGORIES = [
  { value: "ropa", label: "Ropa", icon: "checkroom" },
  { value: "tecnologia", label: "Tecnología", icon: "devices" },
  { value: "experiencia", label: "Experiencia", icon: "explore" },
  { value: "hogar", label: "Hogar", icon: "home" },
  { value: "accesorio", label: "Accesorio", icon: "watch" },
  { value: "otro", label: "Otro", icon: "more_horiz" }
];

const schema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, "Agrega un titulo claro."),
  url: z.string().optional(),
  notes: z.string().optional(),
  price_estimate: z.string().optional(),
  priority: z.string().optional(),
  image_url: z.string().optional(),
  category: z.string().optional(),
  size: z.string().optional(),
  color_preference: z.string().optional(),
  store_name: z.string().optional()
});

export function WishlistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const listQuery = useQuery({
    queryKey: ["wishlist", user?.id],
    queryFn: () => listMyWishlist(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      id: "", title: "", url: "", notes: "", price_estimate: "",
      priority: "media", image_url: "", category: "", size: "",
      color_preference: "", store_name: ""
    }
  });

  const watchUrl = watch("url");
  const selectedCategory = watch("category");

  useEffect(() => {
    if (editing) {
      setShowForm(true);
      reset({
        id: editing.id, title: editing.title, url: editing.url || "",
        notes: editing.notes || "", price_estimate: editing.price_estimate || "",
        priority: editing.priority || "media", image_url: editing.image_url || "",
        category: editing.category || "", size: editing.size || "",
        color_preference: editing.color_preference || "", store_name: editing.store_name || ""
      });
    }
  }, [editing, reset]);

  const saveMutation = useMutation({
    mutationFn: (values) => saveWishlistItem(user.id, values),
    onSuccess: async () => {
      setShowForm(false);
      setEditing(null);
      reset({ id: "", title: "", url: "", notes: "", price_estimate: "", priority: "media", image_url: "", category: "", size: "", color_preference: "", store_name: "" });
      toast.success(editing ? "Regalo actualizado" : "Regalo guardado");
      await queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWishlistItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
      setDeletingId(null);
      toast.success("Regalo eliminado");
    },
    onError: (error) => { setDeletingId(null); toast.error(error.message); }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_fulfilled }) => toggleFulfilled(id, is_fulfilled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    const url = values.url?.trim();
    const formattedUrl = url && !url.startsWith("http") ? `https://${url}` : url;
    await saveMutation.mutateAsync({ ...values, url: formattedUrl || "" });
  });

  const openNewForm = () => {
    setEditing(null);
    reset({ id: "", title: "", url: "", notes: "", price_estimate: "", priority: "media", image_url: "", category: "", size: "", color_preference: "", store_name: "" });
    setShowForm(true);
  };

  if (listQuery.isLoading) return <LoadingState message="Cargando wishlist..." fullScreen />;
  if (listQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState title="No pudimos cargar tu wishlist" description={listQuery.error.message} onRetry={listQuery.refetch} />
      </div>
    );
  }

  const fulfilled = listQuery.data.filter((i) => i.is_fulfilled);
  const pending = listQuery.data.filter((i) => !i.is_fulfilled);

  return (
    <AppShell activeTab="perfil" header={
      <PageHeader action={<NotificationBell />} />
    }>
      <div className="space-y-4 pt-4">
        <section className="space-y-2 px-1">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-bold text-text-muted active:text-text transition-colors mb-1">
            <span className="material-symbols-outlined text-[1rem]">arrow_back</span>
            Volver
          </button>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Mi wishlist</p>
          <h2 className="text-[1.9rem] font-black tracking-tight text-text">Ideas de regalo</h2>
          <p className="text-sm leading-relaxed text-text-muted">
            Lo que tus grupos verán para inspirarse.
          </p>
          <Button
            size="sm"
            className="mt-1 h-9 rounded-full px-5 text-[10px] font-black uppercase tracking-widest shadow-float"
            onClick={openNewForm}
          >
            + Agregar regalo
          </Button>
        </section>

        {/* Form modal */}
        <BottomSheet
          isOpen={showForm}
          onClose={() => { setShowForm(false); setEditing(null); }}
          title={editing ? "Editar regalo" : "Agregar regalo"}
        >
          <div className="max-h-[70vh] overflow-y-auto">
            <form className="space-y-4" onSubmit={onSubmit}>
                <input type="hidden" {...register("id")} />
                <input type="hidden" {...register("category")} />
                <FormField label="Título" error={errors.title?.message}>
                  <Input placeholder="Título del regalo..." {...register("title")} autoFocus />
                </FormField>

                <FormField label="Link">
                  <Input placeholder="https://amazon.com/..." {...register("url")} />
                </FormField>

                <FormField label="Imagen (URL)">
                  <Input placeholder="https://..." {...register("image_url")} />
                </FormField>
                {watchUrl && (
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span className="material-symbols-outlined text-[0.9rem]">info</span>
                    Se agregará automáticamente https:// si no lo incluyes
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Precio estimado">
                    <Input type="number" placeholder="$3499" {...register("price_estimate")} />
                  </FormField>
                  <FormField label="Prioridad">
                    <Select {...register("priority")}>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </Select>
                  </FormField>
                </div>

                <FormField label="Categoría">
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button key={cat.value} type="button"
                        onClick={() => setValue(
                          "category",
                          selectedCategory === cat.value ? "" : cat.value,
                          { shouldDirty: true, shouldTouch: true, shouldValidate: true }
                        )}
                        className={cn("flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-bold transition-all",
                          selectedCategory === cat.value ? "bg-primary text-slate-950 border-primary" : "bg-bg-elevated text-text-muted border-border hover:border-primary/50"
                        )}>
                        <span className="material-symbols-outlined text-[1.1rem]">{cat.icon}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Talla">
                    <Input placeholder="Ej. M, 26..." {...register("size")} />
                  </FormField>
                  <FormField label="Color preferido">
                    <Input placeholder="Ej. Negro" {...register("color_preference")} />
                  </FormField>
                </div>

                <FormField label="Tienda">
                  <Input placeholder="Ej. Amazon, Liverpool..." {...register("store_name")} />
                </FormField>

                <FormField label="Notas">
                  <TextArea rows={2} placeholder="Detalles importantes..." {...register("notes")} />
                </FormField>

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || saveMutation.isPending}>
                  {saveMutation.isPending ? "Guardando..." : editing ? "Actualizar" : "Agregar a mi lista"}
                </Button>
              </form>
            </div>
          </BottomSheet>

        {/* List */}
        <div className="space-y-3">
          {listQuery.data.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <div className="size-20 bg-primary/10 rounded-[1.75rem] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>card_giftcard</span>
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-text">Tu wishlist está vacía</p>
                <p className="text-sm text-text-muted leading-relaxed max-w-[200px] mx-auto">
                  Agrega ideas de regalo para que tus grupos sepan qué regalarte.
                </p>
              </div>
              <Button onClick={openNewForm} size="pill" className="mx-auto">Agregar primer regalo</Button>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="space-y-3">
                  {pending.map((item) => (
                    <Card key={item.id} className="space-y-3 hover:border-primary/20 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {item.category && (
                              <span className="material-symbols-outlined text-[0.9rem] text-primary">
                                {CATEGORIES.find((c) => c.value === item.category)?.icon || "more_horiz"}
                              </span>
                            )}
                            <p className="text-[15px] font-bold text-text leading-tight truncate">{item.title}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {item.price_estimate && <span className="text-sm font-black text-primary">{formatCurrency(item.price_estimate)}</span>}
                            {item.size && <span className="text-xs text-text-muted">Talla: {item.size}</span>}
                            {item.color_preference && <span className="text-xs text-text-muted">• {item.color_preference}</span>}
                            {item.store_name && <span className="text-xs text-text-muted">• {item.store_name}</span>}
                          </div>
                        </div>
                        <span className={cn("flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em]",
                          item.priority === 'alta' ? 'bg-danger/10 text-danger border border-danger/20' :
                          item.priority === 'baja' ? 'bg-success/10 text-success border border-success/20' :
                          'bg-warning/10 text-warning border border-warning/20'
                        )}>
                          {item.priority || 'media'}
                        </span>
                      </div>
                      {item.notes && <p className="text-sm text-text-muted italic leading-relaxed">"{item.notes}"</p>}
                      {item.url && (
                        <a className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[11px] font-black uppercase tracking-wider hover:bg-primary hover:text-slate-950 transition-all active:scale-95" href={item.url} target="_blank" rel="noreferrer">
                          <span className="material-symbols-outlined text-[1rem]">link</span>Ver producto
                        </a>
                      )}
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(item)}>Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: item.id, is_fulfilled: true })}>
                          <span className="material-symbols-outlined text-[1rem]">check_circle</span> Recibido
                        </Button>
                        <Button variant="ghost" size="sm" className="text-danger ml-auto" onClick={() => setDeletingId(item.id)}>
                          <span className="material-symbols-outlined text-[1rem]">delete</span>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {fulfilled.length > 0 && (
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-sm font-bold text-text-muted hover:text-text transition-colors py-2">
                    <span className="material-symbols-outlined text-[1.1rem] transition-transform group-open:rotate-90">chevron_right</span>
                    Recibidos ({fulfilled.length})
                  </summary>
                  <div className="space-y-2 mt-2">
                    {fulfilled.map((item) => (
                      <Card key={item.id} className="p-3 opacity-60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[1rem] text-success">check_circle</span>
                            <p className="text-sm font-bold text-text line-through">{item.title}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => toggleMutation.mutate({ id: item.id, is_fulfilled: false })}>
                            <span className="material-symbols-outlined text-[1rem]">undo</span>
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        <ConfirmDialog
          isOpen={!!deletingId}
          title="¿Eliminar item?"
          description="Este regalo se quitará de tu wishlist permanentemente."
          confirmLabel="Sí, borrar" cancelLabel="Mantener" variant="danger"
          onConfirm={() => deleteMutation.mutate(deletingId)}
          onCancel={() => setDeletingId(null)}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </AppShell>
  );
}
