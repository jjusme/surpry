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
import { useAuth } from "../../auth/AuthContext";
import {
  deletePaymentDestination,
  listPaymentDestinations,
  savePaymentDestination
} from "../service";
import { PAYMENT_DESTINATION_TYPES } from "../../../lib/constants";

const schema = z.object({
  id: z.string().optional(),
  type: z.string().min(1, "Selecciona un tipo."),
  label: z.string().optional(),
  bank_name: z.string().optional(),
  account_holder: z.string().optional(),
  destination_value: z.string().min(4, "Ingresa el dato a compartir."),
  note: z.string().optional(),
  is_default: z.boolean().optional()
});

export function PaymentMethodsPage() {
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [editing, setEditing] = useState(null);
  const listQuery = useQuery({
    queryKey: ["payment-destinations", user?.id],
    queryFn: () => listPaymentDestinations(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      id: "",
      type: "clabe",
      label: "",
      bank_name: "",
      account_holder: "",
      destination_value: "",
      note: "",
      is_default: true
    }
  });

  useEffect(() => {
    if (editing) {
      reset({
        id: editing.id,
        type: editing.type,
        label: editing.label || "",
        bank_name: editing.bank_name || "",
        account_holder: editing.account_holder || "",
        destination_value: editing.destination_value || "",
        note: editing.note || "",
        is_default: Boolean(editing.is_default)
      });
    }
  }, [editing, reset]);

  const saveMutation = useMutation({
    mutationFn: (values) => savePaymentDestination(user.id, values),
    onSuccess: async () => {
      setEditing(null);
      reset({
        id: "",
        type: "clabe",
        label: "",
        bank_name: "",
        account_holder: "",
        destination_value: "",
        note: "",
        is_default: true
      });
      await queryClient.invalidateQueries({ queryKey: ["payment-destinations", user.id] });
      toast.success("Método guardado");
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: deletePaymentDestination,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payment-destinations", user.id] });
      setEditing(null);
      toast.success("Método eliminado");
    },
    onError: (error) => toast.error(error.message)
  });

  const onSubmit = handleSubmit(async (values) => {
    await saveMutation.mutateAsync(values);
  });

  if (listQuery.isLoading) {
    return <LoadingState message="Cargando metodos..." fullScreen />;
  }

  if (listQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tus metodos"
          description={listQuery.error.message}
          onRetry={listQuery.refetch}
        />
      </div>
    );
  }

  return (
    <AppShell
      activeTab="perfil"
      header={<PageHeader title="Metodos de reembolso" backTo="/perfil" />}
    >
      <div className="space-y-4 pt-4">
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-text">
              {editing ? "Editar metodo" : "Agregar metodo"}
            </h2>
            <p className="text-sm text-text-muted">
              Solo se mostrara a personas con shares relacionadas a tus gastos.
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <input type="hidden" {...register("id")} />
            <FormField label="Tipo" error={errors.type?.message}>
              <Select {...register("type")}>
                {PAYMENT_DESTINATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Alias">
              <Input placeholder="BBVA principal" {...register("label")} />
            </FormField>
            <FormField label="Banco">
              <Input placeholder="BBVA" {...register("bank_name")} />
            </FormField>
            <FormField label="Titular">
              <Input placeholder="Nombre del titular" {...register("account_holder")} />
            </FormField>
            <FormField label="Dato a compartir" error={errors.destination_value?.message}>
              <Input placeholder="CLABE, tarjeta o referencia" {...register("destination_value")} />
            </FormField>
            <FormField label="Nota">
              <TextArea rows={2} placeholder="Instrucciones opcionales" {...register("note")} />
            </FormField>
            <label className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3 text-sm font-medium text-text">
              <input type="checkbox" className="size-4" onChange={(event) => setValue("is_default", event.target.checked)} />
              Usar como metodo por defecto
            </label>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando..." : editing ? "Actualizar metodo" : "Guardar metodo"}
            </Button>
          </form>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Tus metodos</h2>
            {editing ? (
              <Button variant="ghost" onClick={() => {
                setEditing(null);
                reset({ id: "", type: "clabe", label: "", bank_name: "", account_holder: "", destination_value: "", note: "", is_default: true });
              }}>
                Cancelar
              </Button>
            ) : null}
          </div>

          {listQuery.data.length === 0 ? (
            <p className="text-sm text-text-muted">Aun no agregas ningun metodo.</p>
          ) : (
            listQuery.data.map((item) => (
              <div key={item.id} className="space-y-3 rounded-2xl bg-surface-muted px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text">{item.label || item.type.toUpperCase()}</p>
                    <p className="text-sm text-text-muted">{item.bank_name || "Sin banco"}</p>
                    <p className="text-sm text-text-muted">{item.destination_value}</p>
                  </div>
                  {item.is_default ? <span className="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-strong">Default</span> : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setEditing(item)}>
                    Editar
                  </Button>
                  <Button variant="danger" className="flex-1" onClick={() => deleteMutation.mutate(item.id)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}
