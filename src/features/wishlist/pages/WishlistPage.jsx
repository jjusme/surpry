import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
  const [serverError, setServerError] = useState("");
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
      await queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
    },
    onError: (error) => setServerError(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWishlistItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
      setEditing(null);
    },
    onError: (error) => setServerError(error.message)
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
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
                Tus grupos podran ver esta lista, pero no sabras si alguien ya lo eligio.
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
            <FormField label="Titulo" error={errors.title?.message}>
              <Input placeholder="Ej. Audifonos Sony" {...register("title")} />
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
              <TextArea rows={3} placeholder="Alguna pista util" {...register("notes")} />
            </FormField>
            {serverError ? <p className="text-sm font-medium text-danger">{serverError}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando..." : editing ? "Actualizar item" : "Agregar item"}
            </Button>
          </form>
        </Card>

        <div className="space-y-3">
          {listQuery.data.length === 0 ? (
            <Card>
              <p className="text-sm text-text-muted">Aun no agregas regalos a tu wishlist.</p>
            </Card>
          ) : (
            listQuery.data.map((item) => (
              <Card key={item.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-text">{item.title}</p>
                    <p className="text-sm text-text-muted">Prioridad {item.priority || "media"}</p>
                    {item.price_estimate ? (
                      <p className="text-sm font-semibold text-primary-strong">
                        {formatCurrency(item.price_estimate)}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-primary/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-strong">
                    {item.priority || "media"}
                  </span>
                </div>
                {item.notes ? <p className="text-sm text-text-muted">{item.notes}</p> : null}
                {item.url ? (
                  <a className="text-sm font-semibold text-primary-strong" href={item.url} target="_blank" rel="noreferrer">
                    Abrir link
                  </a>
                ) : null}
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setEditing(item)}>
                    Editar
                  </Button>
                  <Button variant="danger" className="flex-1" onClick={() => deleteMutation.mutate(item.id)}>
                    Eliminar
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
