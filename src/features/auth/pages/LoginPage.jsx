import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { signInWithGoogle, signInWithPassword } from "../api";
import { useAuth } from "../AuthContext";

const schema = z.object({
  email: z.string().email("Ingresa un correo valido."),
  password: z.string().min(6, "Tu contrasena debe tener al menos 6 caracteres.")
});

export function LoginPage() {
  const navigate = useNavigate();
  const { isSupabaseConfigured } = useAuth();
  const [serverError, setServerError] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");

    try {
      await signInWithPassword(values);
      navigate("/inicio", { replace: true });
    } catch (error) {
      setServerError(error.message);
    }
  });

  const handleGoogle = async () => {
    setServerError("");
    setIsGoogleLoading(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      setServerError(error.message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-3 px-2">
        <div className="inline-flex size-16 items-center justify-center rounded-3xl bg-primary/12 text-primary shadow-float">
          <span className="material-symbols-outlined text-[2rem]">
            card_giftcard
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-text">
            Bienvenido de vuelta
          </h1>
          <p className="max-w-sm text-sm leading-6 text-text-muted">
            Organiza regalos sorpresa, gastos compartidos y reembolsos sin
            depender del chat para la parte operativa.
          </p>
        </div>
      </div>

      <Card className="space-y-5 p-5">
        {!isSupabaseConfigured ? (
          <p className="rounded-2xl bg-warning/10 px-4 py-3 text-sm font-medium text-warning">
            Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para usar
            autenticacion real.
          </p>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField label="Correo" error={errors.email?.message}>
            <Input placeholder="tu@email.com" {...register("email")} />
          </FormField>

          <FormField label="Contrasena" error={errors.password?.message}>
            <Input
              type="password"
              placeholder="Tu contrasena"
              {...register("password")}
            />
          </FormField>

          {serverError ? (
            <p className="text-sm font-medium text-danger">{serverError}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={!isSupabaseConfigured || isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          <span className="h-px flex-1 bg-border" />
          O
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={handleGoogle}
          disabled={!isSupabaseConfigured || isGoogleLoading}
        >
          <span className="material-symbols-outlined">login</span>
          {isGoogleLoading ? "Conectando..." : "Continuar con Google"}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <Link className="font-semibold text-primary" to="/registro">
            Crear cuenta
          </Link>
          <Link className="font-semibold text-text-muted" to="/recuperar">
            Recuperar acceso
          </Link>
        </div>
      </Card>
    </>
  );
}
