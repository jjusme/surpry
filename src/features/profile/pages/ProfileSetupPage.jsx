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
  upsertProfile
} from "../service";

const schema = z.object({
  display_name: z.string().min(2, "Tu nombre debe tener al menos 2 caracteres."),
  birthday_day: z.coerce.number().min(1).max(31),
  birthday_month: z.coerce.number().min(1).max(12)
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

export function ProfileSetupPage() {
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
      birthday_month: ""
    }
  });

  useEffect(() => {
    if (profileQuery.data) {
      reset({
        display_name: profileQuery.data.display_name || user?.user_metadata?.display_name || "",
        birthday_day: profileQuery.data.birthday_day || "",
        birthday_month: profileQuery.data.birthday_month || ""
      });
    }
  }, [profileQuery.data, reset, user?.user_metadata?.display_name]);

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      await upsertProfile(user.id, values);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["payment-destinations", user.id] })
      ]);
      localStorage.setItem("has_completed_setup", "true");
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
    return <LoadingState message="Preparando tu perfil..." fullScreen />;
  }

  if (profileQuery.isLoading) {
    return <LoadingState message="Cargando tus datos..." fullScreen />;
  }

  if (profileQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar tu perfil"
          description={profileQuery.error.message}
          onRetry={profileQuery.refetch}
        />
      </div>
    );
  }

  const hasCompletedSetup = localStorage.getItem("has_completed_setup") === "true";

  return (
    <AppShell hideNav header={<PageHeader title="Configura tu perfil" subtitle="Paso final" backTo={hasCompletedSetup ? "/perfil" : undefined} />}>
      <form className="space-y-4 pt-4 pb-12" onSubmit={onSubmit}>
        <div className="flex flex-col items-center gap-2 mb-4 text-center">
          <div className="size-20 rounded-[1.5rem] bg-primary/15 flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-[2.5rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
          </div>
          <h2 className="text-2xl font-black text-text">Dinos quién eres</h2>
          <p className="text-sm text-text-muted px-6">Para que tus amigos sepan cuándo es tu cumple.</p>
        </div>

        <Card className="space-y-4">
          <FormField label="Tu nombre / apodo" error={errors.display_name?.message}>
            <Input placeholder="Cómo te verán los demás" {...register("display_name")} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Día de cumple" error={errors.birthday_day?.message}>
              <Input type="number" min="1" max="31" placeholder="Ej. 15" {...register("birthday_day")} />
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

        {serverError ? <p className="text-sm font-medium text-danger bg-danger/5 p-3 rounded-xl border border-danger/20">{serverError}</p> : null}

        <Button type="submit" size="pill" className="w-full h-14 text-lg font-black shadow-lg" disabled={!isSupabaseConfigured || isSubmitting || saveMutation.isPending}>
          {isSubmitting || saveMutation.isPending ? "Configurando..." : "¡Guardar!"}
        </Button>
      </form>
    </AppShell>
  );
}
