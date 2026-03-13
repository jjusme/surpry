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
  email: z.string().email("Ingresa un correo valido."),
  password: z.string().min(8, "Usa al menos 8 caracteres.")
});

export function RegisterPage() {
  const navigate = useNavigate();
  const { isSupabaseConfigured } = useAuth();
  const [serverError, setServerError] = useState("");
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
      navigate("/onboarding", { replace: true });
    } catch (error) {
      setServerError(error.message);
    }
  });

  return (
    <>
      <div className="space-y-2 px-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
          Nuevo espacio secreto
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-text">
          Crea tu cuenta
        </h1>
        <p className="text-sm leading-6 text-text-muted">
          Empieza a organizar cumpleanos sorpresa con wishlist, gastos y
          reembolsos sin exponer al cumpleanero.
        </p>
      </div>

      <Card className="space-y-5 p-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField label="Nombre visible" error={errors.displayName?.message}>
            <Input placeholder="Tu nombre" {...register("displayName")} />
          </FormField>

          <FormField label="Correo" error={errors.email?.message}>
            <Input placeholder="tu@email.com" {...register("email")} />
          </FormField>

          <FormField label="Contrasena" error={errors.password?.message}>
            <Input
              type="password"
              placeholder="Minimo 8 caracteres"
              {...register("password")}
            />
          </FormField>

          {serverError ? (
            <p className="text-sm font-medium text-danger">{serverError}</p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!isSupabaseConfigured || isSubmitting}
          >
            {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={signInWithGoogle}
          disabled={!isSupabaseConfigured}
        >
          <span className="material-symbols-outlined">star</span>
          Continuar con Google
        </Button>

        <p className="text-center text-sm text-text-muted">
          Ya tienes cuenta? {" "}
          <Link className="font-semibold text-primary" to="/login">
            Entrar
          </Link>
        </p>
      </Card>
    </>
  );
}
