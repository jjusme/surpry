import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SizeSelector } from "../../../components/ui/SizeSelector";
import { TagInput } from "../../../components/ui/TagInput";

function StylePicker({ value = [], onChange }) {
  const [showInput, setShowInput] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const inputRef = useRef(null);

  const toggle = (style) => {
    if (value.includes(style)) onChange(value.filter((v) => v !== style));
    else onChange([...value, style]);
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setCustomInput("");
    setShowInput(false);
  };

  const openInput = () => {
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Estilo de vestir</p>
      <div className="flex flex-wrap gap-2">
        {CLOTHING_STYLE_SUGGESTIONS.map((s) => {
          const selected = value.includes(s);
          return (
            <button key={s} type="button" onClick={() => toggle(s)}
              className={`h-9 rounded-xl px-4 text-sm font-bold transition-all border ${selected ? "bg-primary text-slate-950 border-primary shadow-float" : "bg-bg-elevated text-text border-border hover:border-primary/50"}`}>
              {s}
            </button>
          );
        })}
        {value.filter((v) => !CLOTHING_STYLE_SUGGESTIONS.includes(v)).map((v) => (
          <button key={v} type="button" onClick={() => toggle(v)}
            className="inline-flex items-center gap-1 h-9 rounded-xl px-4 text-sm font-bold bg-primary text-slate-950 border border-primary shadow-float">
            {v}
            <span className="material-symbols-outlined text-[0.85rem] ml-1">close</span>
          </button>
        ))}
        {!showInput && (
          <button type="button" onClick={openInput}
            className="h-9 rounded-xl px-3 text-sm font-bold border border-dashed border-border text-text-muted hover:border-primary/50 hover:text-text transition-all">
            + Otro
          </button>
        )}
      </div>
      {showInput && (
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="text" value={customInput} onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } if (e.key === "Escape") { setShowInput(false); setCustomInput(""); } }}
            onBlur={addCustom}
            placeholder="Ej. Gótico, Y2K, Dark academic..."
            className="flex-1 h-9 rounded-xl border border-primary bg-bg-elevated px-3 text-sm text-text placeholder:text-text-muted outline-none" />
        </div>
      )}
    </div>
  );
}
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useAuth } from "../../auth/AuthContext";
import { getMyProfile, uploadAvatar, upsertProfile } from "../service";

const step1Schema = z.object({
  display_name: z.string().min(2, "Tu nombre debe tener al menos 2 caracteres."),
  birthday_day: z.coerce.number().min(1, "Ingresa un día válido.").max(31, "Máximo 31."),
  birthday_month: z.coerce.number().min(1, "Selecciona un mes.").max(12)
});

const months = [
  [1, "Enero"], [2, "Febrero"], [3, "Marzo"], [4, "Abril"],
  [5, "Mayo"], [6, "Junio"], [7, "Julio"], [8, "Agosto"],
  [9, "Septiembre"], [10, "Octubre"], [11, "Noviembre"], [12, "Diciembre"]
];

const CLOTHING_STYLE_SUGGESTIONS = ["Casual", "Deportivo", "Formal", "Elegante", "Streetwear", "Bohemio", "Vintage", "Minimalista"];

export function ProfileSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [sizes, setSizes] = useState({ shirt_size: "", shoe_size: "", pants_size: "", clothing_styles: [] });
  const [preferences, setPreferences] = useState({
    favorite_colors: [], favorite_brands: [], hobbies: [],
    dietary_restrictions: [], dislikes: []
  });

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getMyProfile(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });

  const {
    register, handleSubmit, reset, getValues,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      display_name: user?.user_metadata?.display_name || "",
      birthday_day: "",
      birthday_month: ""
    }
  });

  useEffect(() => {
    if (profileQuery.data) {
      const p = profileQuery.data;
      reset({
        display_name: p.display_name || user?.user_metadata?.display_name || "",
        birthday_day: p.birthday_day || "",
        birthday_month: p.birthday_month || ""
      });
      if (p.avatar_url) setAvatarPreview(p.avatar_url);
      setSizes({
        shirt_size: p.shirt_size || "",
        shoe_size: p.shoe_size || "",
        pants_size: p.pants_size || "",
        clothing_styles: p.clothing_styles || []
      });
      setPreferences({
        favorite_colors: p.favorite_colors || [],
        favorite_brands: p.favorite_brands || [],
        hobbies: p.hobbies || [],
        dietary_restrictions: p.dietary_restrictions || [],
        dislikes: p.dislikes || []
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
        queryClient.invalidateQueries({ queryKey: ["payment-destinations", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile-setup-check", user.id] })
      ]);
      navigate("/inicio", { replace: true });
    },
    onError: (error) => {
      setServerError(error.message);
    }
  });

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      setAvatarPreview(url);
    } catch (error) {
      toast.error("Error al subir imagen");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStep1Submit = handleSubmit((values) => {
    setServerError("");
    setStep(2);
  });

  const handleSave = async () => {
    setServerError("");
    const step1Data = getValues();
    try {
      await saveMutation.mutateAsync({
        ...step1Data,
        avatar_url: avatarPreview || null,
        ...sizes,
        ...preferences,
        has_completed_setup: true
      });
    } catch (e) {
      setServerError(e.message);
    }
  };

  const handleSkip = async () => {
    setServerError("");
    const step1Data = getValues();
    try {
      await saveMutation.mutateAsync({
        ...step1Data,
        avatar_url: avatarPreview || null,
        ...sizes,
        ...preferences,
        has_completed_setup: true
      });
    } catch (e) {
      setServerError(e.message);
    }
  };

  if (!user) return <LoadingState message="Preparando tu perfil..." fullScreen />;
  if (profileQuery.isLoading) return <LoadingState message="Cargando tus datos..." fullScreen />;
  if (profileQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState title="No pudimos cargar tu perfil" description={profileQuery.error.message} onRetry={profileQuery.refetch} />
      </div>
    );
  }

  const hasCompletedSetup = profileQuery.data?.has_completed_setup === true;

  return (
    <AppShell hideNav header={
      <PageHeader
        title="Configura tu perfil"
        subtitle={`Paso ${step} de 3`}
        backTo={hasCompletedSetup ? "/perfil" : undefined}
      />
    }>
      <div className="space-y-4 pt-4 pb-12">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? "w-8 bg-primary" : s < step ? "w-4 bg-primary/50" : "w-4 bg-surface-muted"}`} />
          ))}
        </div>

        {/* STEP 1: Who are you */}
        {step === 1 && (
          <form className="space-y-4" onSubmit={handleStep1Submit}>
            <div className="flex flex-col items-center gap-2 mb-4 text-center">
              <div className="relative group">
                <div className="size-24 rounded-[2rem] bg-primary/15 flex items-center justify-center overflow-hidden ring-4 ring-bg shadow-float">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-[3rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white animate-spin">sync</span>
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 size-10 bg-primary text-slate-950 rounded-2xl flex items-center justify-center cursor-pointer shadow-float hover:scale-110 active:scale-95 transition-all">
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={isUploading} />
                  <span className="material-symbols-outlined text-[1.25rem]">add_a_photo</span>
                </label>
              </div>
              <div className="mt-2">
                <h2 className="text-2xl font-black text-text">Dinos quién eres</h2>
                <p className="text-sm text-text-muted px-6">Para que tus amigos sepan cuándo es tu cumple.</p>
              </div>
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
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
            </Card>

            {serverError && <p className="text-sm font-medium text-danger bg-danger/5 p-3 rounded-xl border border-danger/20">{serverError}</p>}

            <div className="space-y-2">
              <Button type="submit" size="pill" className="w-full h-14 text-lg font-black shadow-lg">
                Continuar
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Sizes */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-black text-text">Tus tallas</h2>
              <p className="text-sm text-text-muted px-6">Para que sepan qué talla usar en regalos de ropa.</p>
            </div>

            <Card className="space-y-5">
              <SizeSelector label="Talla de camisa" value={sizes.shirt_size} onChange={(v) => setSizes((s) => ({ ...s, shirt_size: v }))} />
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Talla de zapato</p>
                <Input placeholder="Ej. 26, 9 US, 42 EU" value={sizes.shoe_size} onChange={(e) => setSizes((s) => ({ ...s, shoe_size: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Talla de pantalón</p>
                <Input placeholder="Ej. 30, 29x32" value={sizes.pants_size} onChange={(e) => setSizes((s) => ({ ...s, pants_size: e.target.value }))} />
              </div>
              <StylePicker
                value={sizes.clothing_styles}
                onChange={(v) => setSizes((prev) => ({ ...prev, clothing_styles: v }))}
              />
            </Card>

            {serverError && <p className="text-sm font-medium text-danger bg-danger/5 p-3 rounded-xl border border-danger/20">{serverError}</p>}

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(1)} className="flex-1 h-12">
                Atrás
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1 h-12 font-bold">
                Continuar
              </Button>
            </div>
            <button type="button" onClick={() => setStep(3)} className="w-full py-2 text-sm font-bold text-text-muted/60 active:opacity-50 transition-opacity">
              Saltar esta parte
            </button>
          </div>
        )}

        {/* STEP 3: Preferences */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-black text-text">Tus gustos</h2>
              <p className="text-sm text-text-muted px-6">Lo que te gusta (y lo que no) para recibir de regalo.</p>
            </div>

            <Card className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Colores favoritos</p>
                <TagInput value={preferences.favorite_colors} onChange={(v) => setPreferences((p) => ({ ...p, favorite_colors: v }))} placeholder="Ej. negro, azul..." />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Marcas / tiendas</p>
                <TagInput value={preferences.favorite_brands} onChange={(v) => setPreferences((p) => ({ ...p, favorite_brands: v }))} placeholder="Ej. Nike, Zara..." />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Hobbies / intereses</p>
                <TagInput value={preferences.hobbies} onChange={(v) => setPreferences((p) => ({ ...p, hobbies: v }))} placeholder="Ej. fotografía, gaming..." />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Restricciones alimentarias</p>
                <TagInput value={preferences.dietary_restrictions} onChange={(v) => setPreferences((p) => ({ ...p, dietary_restrictions: v }))} placeholder="Ej. vegano, sin gluten..." />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Lo que NO quiero recibir</p>
                <TagInput value={preferences.dislikes} onChange={(v) => setPreferences((p) => ({ ...p, dislikes: v }))} placeholder="Ej. perfumes, calcetines..." />
              </div>
            </Card>

            {serverError && <p className="text-sm font-medium text-danger bg-danger/5 p-3 rounded-xl border border-danger/20">{serverError}</p>}

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(2)} className="flex-1 h-12">
                Atrás
              </Button>
              <Button onClick={handleSave} className="flex-1 h-12 font-bold" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : "¡Listo!"}
              </Button>
            </div>
            <button type="button" onClick={handleSave} className="w-full py-2 text-sm font-bold text-text-muted/60 active:opacity-50 transition-opacity" disabled={saveMutation.isPending}>
              Saltar y terminar
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
