import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { sendPasswordReset } from "../api";
import { useAuth } from "../AuthContext";

const schema = z.object({
  email: z.string().email("Ingresa un correo válido.")
});

export function ForgotPasswordPage() {
  const { isSupabaseConfigured } = useAuth();
  const [message, setMessage] = useState("");
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: ""
    }
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setMessage("");
    setServerError("");

    try {
      await sendPasswordReset(email);
      setMessage("Te enviamos un enlace para recuperar tu acceso.");
    } catch (error) {
      setServerError(error.message);
    }
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-text">
          Recupera tu acceso
        </h1>
        <p className="text-sm leading-6 text-text-muted">
          Te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      <Card className="space-y-5 p-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField label="Correo" error={errors.email?.message}>
            <Input placeholder="tu@email.com" {...register("email")} />
          </FormField>

          {message ? (
            <p className="text-sm font-medium text-success">{message}</p>
          ) : null}
          {serverError ? (
            <p className="text-sm font-medium text-danger">{serverError}</p>
          ) : null}

          <Button
            type="submit"
            size="pill"
            className="w-full"
            disabled={!isSupabaseConfigured || isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Enviar enlace"}
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted">
          <Link className="font-bold text-primary" to="/login">
            Volver a iniciar sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}
