import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
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
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useAuth } from "../../auth/AuthContext";
import { deleteWishlistItem, listMyWishlist, saveWishlistItem } from "../service";
import { formatCurrency } from "../../../utils/format";

const schema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, "Agrega un titulo claro."),
  url: z.string().optional(),
  notes: z.string().optional(),
  price_estimate: z.string().optional(),
  priority: z.string().optional()
});

export function WishlistPage() {
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const listQuery = useQuery({
    queryKey: ["wishlist", user?.id],
    queryFn: () => listMyWishlist(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      id: "",
      title: "",
      url: "",
      notes: "",
      price_estimate: "",
      priority: "media"
    }
  });

  useEffect(() => {
    if (editing) {
      reset({
        id: editing.id,
        title: editing.title,
        url: editing.url || "",
        notes: editing.notes || "",
        price_estimate: editing.price_estimate || "",
        priority: editing.priority || "media"
      });
    }
  }, [editing, reset]);

  const saveMutation = useMutation({
    mutationFn: (values) => saveWishlistItem(user.id, values),
    onSuccess: async () => {
      setEditing(null);
      reset({ id: "", title: "", url: "", notes: "", price_estimate: "", priority: "media" });
      toast.success("Regalo guardado");
      await queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWishlistItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
      setEditing(null);
      setDeletingId(null);
      toast.success("Regalo eliminado");
    },
    onError: (error) => {
      setDeletingId(null);
      toast.error(error.message);
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    await saveMutation.mutateAsync(values);
  });

  if (listQuery.isLoading) {
    return <LoadingState message="Cargando wishlist..." fullScreen />;
  }

  if (listQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tu wishlist"
          description={listQuery.error.message}
          onRetry={listQuery.refetch}
        />
      </div>
    );
  }

  return (
    <AppShell
      activeTab="perfil"
      header={<PageHeader title="Mi wishlist" subtitle="Ideas de regalo" backTo="/perfil" />}
    >
      <div className="space-y-4 pt-4">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text">
                {editing ? "Editar regalo" : "Agregar regalo"}
              </h2>
              <p className="text-sm text-text-muted">
                Tus grupos podrán ver esta lista, pero no sabrás si alguien ya lo eligió.
              </p>
            </div>
            {editing ? (
              <Button variant="ghost" onClick={() => {
                setEditing(null);
                reset({ id: "", title: "", url: "", notes: "", price_estimate: "", priority: "media" });
              }}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <input type="hidden" {...register("id")} />
            <FormField label="Título" error={errors.title?.message}>
              <Input placeholder="Título del regalo..." {...register("title")} />
            </FormField>
            <FormField label="Link">
              <Input placeholder="https://..." {...register("url")} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Precio estimado">
                <Input type="number" placeholder="3499" {...register("price_estimate")} />
              </FormField>
              <FormField label="Prioridad">
                <Select {...register("priority")}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Nota">
              <TextArea rows={3} placeholder="Detalles importantes..." {...register("notes")} />
            </FormField>
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando..." : editing ? "Actualizar item" : "Agregar item"}
            </Button>
          </form>
        </Card>

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
            </div>
          ) : (
            listQuery.data.map((item) => (
              <Card key={item.id} className="space-y-3 hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-text leading-tight">{item.title}</p>
                    {item.price_estimate ? (
                      <p className="text-sm font-black text-primary mt-0.5">{formatCurrency(item.price_estimate)}</p>
                    ) : null}
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${
                    item.priority === 'alta' ? 'bg-danger/10 text-danger border border-danger/20' :
                    item.priority === 'baja' ? 'bg-success/10 text-success border border-success/20' :
                    'bg-warning/10 text-warning border border-warning/20'
                  }`}>
                    {item.priority || 'media'}
                  </span>
                </div>
                {item.notes ? <p className="text-sm text-text-muted italic leading-relaxed">"{item.notes}"</p> : null}
                {item.url ? (
                  <a className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[11px] font-black uppercase tracking-wider hover:bg-primary hover:text-slate-950 transition-all active:scale-95" href={item.url} target="_blank" rel="noreferrer">
                    <span className="material-symbols-outlined text-[1rem]">link</span>
                    Ver producto
                  </a>
                ) : null}
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setEditing(item)}>Editar</Button>
                  <Button variant="danger" className="flex-1" onClick={() => setDeletingId(item.id)}>Eliminar</Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <ConfirmDialog
          isOpen={!!deletingId}
          title="¿Eliminar item?"
          description="Este regalo se quitará de tu wishlist permanentemente."
          confirmLabel="Sí, borrar"
          cancelLabel="Mantener"
          variant="danger"
          onConfirm={() => deleteMutation.mutate(deletingId)}
          onCancel={() => setDeletingId(null)}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </AppShell>
  );
}
