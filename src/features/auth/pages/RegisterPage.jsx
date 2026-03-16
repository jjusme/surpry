import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { signInWithGoogle, signUpWithPassword } from "../api";
import { useAuth } from "../AuthContext";

const schema = z.object({
  displayName: z.string().min(2, "Tu nombre debe tener al menos 2 caracteres."),
  email: z.string().email("Ingresa un correo válido."),
  password: z.string().min(8, "Usa al menos 8 caracteres.")
});

export function RegisterPage() {
  const navigate = useNavigate();
  const { isSupabaseConfigured } = useAuth();
  const [serverError, setServerError] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: "",
      email: "",
      password: ""
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");

    try {
      await signUpWithPassword(values);
      setIsSuccess(true);
      // We don't redirect immediately so they can read the "check email" message
    } catch (error) {
      setServerError(error.message);
    }
  });

  const handleGoogle = async () => {
    setServerError("");
    setIsGoogleLoading(true);
    try {
      const pendingToken = localStorage.getItem("pending_invite_token");
      const redirectTo = pendingToken 
        ? `${window.location.origin}/join/${pendingToken}`
        : `${window.location.origin}/inicio`;
      await signInWithGoogle(redirectTo);
    } catch (error) {
      setServerError(error.message);
      setIsGoogleLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-8 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-20 items-center justify-center rounded-[1.75rem] bg-success/15 shadow-float">
            <span className="material-symbols-outlined text-[2.5rem] text-success" style={{ fontVariationSettings: "'FILL' 1" }}>
              mark_email_read
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-text">
              ¡Casi listo!
            </h1>
            <p className="text-sm leading-6 text-text-muted px-4">
              Hemos enviado un enlace de confirmación a tu correo. Por favor verifícalo para poder entrar a tu cuenta.
            </p>
          </div>
        </div>
        <Card className="p-5 text-center space-y-4">
          <p className="text-sm text-text-muted italic">¿Ya confirmaste?</p>
          <Button asChild size="pill" className="w-full">
            <Link to="/login">Ir a Iniciar Sesión</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
            Nuevo espacio secreto
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-text">
            Crea tu cuenta
          </h1>
          <p className="text-sm leading-6 text-text-muted">
            Empieza a organizar cumpleaños sorpresa con wishlist, gastos y
            reembolsos sin exponer al cumpleañero.
          </p>
        </div>
      </div>

      <Card className="space-y-5 p-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField label="Nombre visible" error={errors.displayName?.message}>
            <Input
              placeholder="Tu nombre"
              autoComplete="name"
              {...register("displayName")}
            />
          </FormField>

          <FormField label="Correo" error={errors.email?.message}>
            <Input
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              {...register("email")}
            />
          </FormField>

          <FormField label="Contraseña" error={errors.password?.message}>
            <Input
              type="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              {...register("password")}
            />
          </FormField>

          {serverError ? (
            <p className="text-sm font-medium text-danger">{serverError}</p>
          ) : null}

          <Button
            type="submit"
            size="pill"
            className="w-full"
            disabled={!isSupabaseConfigured || isSubmitting}
          >
            {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
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
          className="w-full bg-surface hover:bg-surface-muted border border-border shadow-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          onClick={handleGoogle}
          disabled={!isSupabaseConfigured || isGoogleLoading}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="font-bold text-text">
            {isGoogleLoading ? "Conectando..." : "Continuar con Google"}
          </span>
        </Button>

        <p className="text-center text-sm text-text-muted">
          ¿Ya tienes cuenta? {" "}
          <Link className="font-bold text-primary" to="/login">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
