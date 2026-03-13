import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useAuth } from "../../auth/AuthContext";
import {
  getMyProfile,
  savePaymentDestination,
  upsertProfile
} from "../service";
import { saveWishlistItem } from "../../wishlist/service";
import { PAYMENT_DESTINATION_TYPES } from "../../../lib/constants";

const schema = z.object({
  display_name: z.string().min(2, "Tu nombre debe tener al menos 2 caracteres."),
  birthday_day: z.coerce.number().min(1).max(31),
  birthday_month: z.coerce.number().min(1).max(12),
  wishlist_title: z.string().optional(),
  wishlist_url: z.string().optional(),
  wishlist_notes: z.string().optional(),
  wishlist_price: z.string().optional(),
  payment_type: z.string().optional(),
  payment_label: z.string().optional(),
  payment_bank_name: z.string().optional(),
  payment_account_holder: z.string().optional(),
  payment_destination_value: z.string().optional(),
  payment_note: z.string().optional()
});

const months = [
  [1, "Enero"],
  [2, "Febrero"],
  [3, "Marzo"],
  [4, "Abril"],
  [5, "Mayo"],
  [6, "Junio"],
  [7, "Julio"],
  [8, "Agosto"],
  [9, "Septiembre"],
  [10, "Octubre"],
  [11, "Noviembre"],
  [12, "Diciembre"]
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [serverError, setServerError] = useState("");
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getMyProfile(user.id),
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
      display_name: user?.user_metadata?.display_name || "",
      birthday_day: "",
      birthday_month: "",
      wishlist_title: "",
      wishlist_url: "",
      wishlist_notes: "",
      wishlist_price: "",
      payment_type: "",
      payment_label: "",
      payment_bank_name: "",
      payment_account_holder: "",
      payment_destination_value: "",
      payment_note: ""
    }
  });

  useEffect(() => {
    if (profileQuery.data) {
      reset({
        display_name: profileQuery.data.display_name || user?.user_metadata?.display_name || "",
        birthday_day: profileQuery.data.birthday_day || "",
        birthday_month: profileQuery.data.birthday_month || "",
        wishlist_title: "",
        wishlist_url: "",
        wishlist_notes: "",
        wishlist_price: "",
        payment_type: "",
        payment_label: "",
        payment_bank_name: "",
        payment_account_holder: "",
        payment_destination_value: "",
        payment_note: ""
      });
    }
  }, [profileQuery.data, reset, user?.user_metadata?.display_name]);

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      await upsertProfile(user.id, values);

      if (values.wishlist_title) {
        await saveWishlistItem(user.id, {
          title: values.wishlist_title,
          url: values.wishlist_url,
          notes: values.wishlist_notes,
          price_estimate: values.wishlist_price
        });
      }

      if (values.payment_type && values.payment_destination_value) {
        await savePaymentDestination(user.id, {
          type: values.payment_type,
          label: values.payment_label,
          bank_name: values.payment_bank_name,
          account_holder: values.payment_account_holder,
          destination_value: values.payment_destination_value,
          note: values.payment_note,
          is_default: true
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["payment-destinations", user.id] })
      ]);
      navigate("/inicio", { replace: true });
    },
    onError: (error) => {
      setServerError(error.message);
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    await saveMutation.mutateAsync(values);
  });

  if (!user) {
    return <LoadingState message="Preparando onboarding..." fullScreen />;
  }

  if (profileQuery.isLoading) {
    return <LoadingState message="Cargando tu perfil..." fullScreen />;
  }

  if (profileQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos preparar tu onboarding"
          description={profileQuery.error.message}
          onRetry={profileQuery.refetch}
        />
      </div>
    );
  }

  return (
    <AppShell hideNav header={<PageHeader title="Completa tu perfil" subtitle="Onboarding" />}>
      <form className="space-y-4 pt-4" onSubmit={onSubmit}>
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-text">1. Tu perfil</h2>
            <p className="text-sm text-text-muted">
              Esta informacion se usa para grupos, calendario y eventos futuros.
            </p>
          </div>

          <FormField label="Nombre visible" error={errors.display_name?.message}>
            <Input placeholder="Como te veran los demas" {...register("display_name")} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Dia" error={errors.birthday_day?.message}>
              <Input type="number" min="1" max="31" placeholder="15" {...register("birthday_day")} />
            </FormField>
            <FormField label="Mes" error={errors.birthday_month?.message}>
              <Select {...register("birthday_month")}>
                <option value="">Selecciona</option>
                {months.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-text">2. Primer regalo sugerido</h2>
            <p className="text-sm text-text-muted">
              Es opcional, pero ayuda a que tu primer evento tenga contexto desde el dia uno.
            </p>
          </div>

          <FormField label="Titulo">
            <Input placeholder="Ej. Audifonos Sony" {...register("wishlist_title")} />
          </FormField>
          <FormField label="Link">
            <Input placeholder="https://..." {...register("wishlist_url")} />
          </FormField>
          <FormField label="Precio estimado">
            <Input type="number" placeholder="3499" {...register("wishlist_price")} />
          </FormField>
          <FormField label="Nota">
            <TextArea rows={3} placeholder="Alguna pista util" {...register("wishlist_notes")} />
          </FormField>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-text">3. Metodo de reembolso</h2>
            <p className="text-sm text-text-muted">
              Tambien es opcional. Solo se mostrara cuando tengas gastos relacionados.
            </p>
          </div>

          <FormField label="Tipo">
            <Select {...register("payment_type")}>
              <option value="">Selecciona</option>
              {PAYMENT_DESTINATION_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Alias interno">
            <Input placeholder="BBVA personal" {...register("payment_label")} />
          </FormField>
          <FormField label="Banco">
            <Input placeholder="BBVA" {...register("payment_bank_name")} />
          </FormField>
          <FormField label="Titular">
            <Input placeholder="Nombre del beneficiario" {...register("payment_account_holder")} />
          </FormField>
          <FormField label="Dato a compartir">
            <Input placeholder="CLABE, tarjeta o referencia" {...register("payment_destination_value")} />
          </FormField>
          <FormField label="Nota opcional">
            <TextArea rows={2} placeholder="Ej. transferencia solo entre semana" {...register("payment_note")} />
          </FormField>
        </Card>

        {serverError ? <p className="text-sm font-medium text-danger">{serverError}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={!isSupabaseConfigured || isSubmitting || saveMutation.isPending}>
          {isSubmitting || saveMutation.isPending ? "Guardando..." : "Terminar onboarding"}
        </Button>
      </form>
    </AppShell>
  );
}
