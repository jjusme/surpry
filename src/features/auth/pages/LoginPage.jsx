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
  email: z.string().email("Ingresa un correo válido."),
  password: z.string().min(6, "Tu contraseña debe tener al menos 6 caracteres.")
});

export function LoginPage() {
  const navigate = useNavigate();
  const { isSupabaseConfigured } = useAuth();
  const [serverError, setServerError] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
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
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-20 items-center justify-center rounded-[1.75rem] bg-primary/15 shadow-float">
          <span
            className="material-symbols-outlined text-[2.5rem] text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            card_giftcard
          </span>
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-text">
            Bienvenido de vuelta
          </h1>
          <p className="text-sm text-text-muted">
            Organiza regalos sorpresa con tus grupos
          </p>
        </div>
      </div>

      <Card className="space-y-5 p-5">
        {!isSupabaseConfigured ? (
          <p className="rounded-2xl bg-warning/10 px-4 py-3 text-sm font-medium text-warning">
            Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env.
          </p>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField label="Correo" error={errors.email?.message}>
            <Input
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              {...register("email")}
            />
          </FormField>

          <FormField label="Contraseña" error={errors.password?.message}>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                className="pr-12"
                {...register("password")}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
                onClick={() => setShowPass((v) => !v)}
              >
                <span className="material-symbols-outlined text-[1.25rem]">
                  {showPass ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </FormField>

          <div className="flex justify-end">
            <Link className="text-sm font-semibold text-primary" to="/recuperar">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {serverError ? (
            <p className="text-sm font-medium text-danger">{serverError}</p>
          ) : null}

          <Button
            type="submit"
            size="pill"
            disabled={!isSupabaseConfigured || isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Iniciar sesión"}
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
          ¿No tienes cuenta?{" "}
          <Link className="font-bold text-primary" to="/registro">
            Regístrate
          </Link>
        </p>
      </Card>
    </div>
  );
}
