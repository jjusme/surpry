import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { FormField } from "../../../components/ui/FormField";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useAuth } from "../../auth/AuthContext";
import { listGroups } from "../../groups/service";
import { requireSupabase } from "../../../lib/supabase";
import { cn } from "../../../utils/cn";

function daysUntilBirthday(day, month) {
  if (!day || !month) return null;
  const today = new Date();
  const year = today.getFullYear();
  let next = new Date(year, month - 1, day);
  if (next < today) next = new Date(year + 1, month - 1, day);
  return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
}

function formatBirthdayDate(day, month) {
  const date = new Date(2000, month - 1, day);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long" });
}

async function listManualBirthdays(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("manual_birthdays")
    .select("*")
    .eq("user_id", userId)
    .order("birthday_month", { ascending: true })
    .order("birthday_day", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function addManualBirthday(userId, values) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("manual_birthdays")
    .insert({
      user_id: userId,
      display_name: values.display_name,
      birthday_day: Number(values.birthday_day),
      birthday_month: Number(values.birthday_month)
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function deleteManualBirthday(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("manual_birthdays").delete().eq("id", id);
  if (error) throw error;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function UpcomingBirthdaysPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ display_name: "", birthday_day: "", birthday_month: "" });

  const groupsQuery = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: () => listGroups(user.id),
    enabled: !!user?.id
  });
  const manualQuery = useQuery({
    queryKey: ["manual-birthdays", user?.id],
    queryFn: () => listManualBirthdays(user.id),
    enabled: !!user?.id
  });

  const addMutation = useMutation({
    mutationFn: (values) => addManualBirthday(user.id, values),
    onSuccess: () => {
      toast.success("Cumpleaños guardado");
      setForm({ display_name: "", birthday_day: "", birthday_month: "" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["manual-birthdays", user.id] });
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: deleteManualBirthday,
    onSuccess: () => {
      toast.success("Eliminado");
      queryClient.invalidateQueries({ queryKey: ["manual-birthdays", user.id] });
    }
  });

  if (groupsQuery.isLoading || manualQuery.isLoading)
    return <LoadingState message="Cargando cumpleañeros..." fullScreen />;
  if (groupsQuery.isError)
    return <ErrorState title="Error" description={groupsQuery.error.message} />;

  // Build unified list from groups + manual entries
  const fromGroups = (groupsQuery.data || []).flatMap((g) =>
    (g.members || [])
      .filter((m) => m.user_id !== user.id && m.profiles?.birthday_day)
      .map((m) => ({
        id: m.profiles.id,
        display_name: m.profiles.display_name,
        avatar_url: m.profiles.avatar_url,
        birthday_day: m.profiles.birthday_day,
        birthday_month: m.profiles.birthday_month,
        days: daysUntilBirthday(m.profiles.birthday_day, m.profiles.birthday_month),
        type: "profile",
        group_name: g.name
      }))
  );

  // Deduplicate by profile id
  const uniqueFromGroups = Array.from(new Map(fromGroups.map(m => [m.id, m])).values());

  const fromManual = (manualQuery.data || []).map((m) => ({
    id: `manual_${m.id}`,
    manual_id: m.id,
    display_name: m.display_name,
    avatar_url: null,
    birthday_day: m.birthday_day,
    birthday_month: m.birthday_month,
    days: daysUntilBirthday(m.birthday_day, m.birthday_month),
    type: "manual"
  }));

  const allBirthdays = [...uniqueFromGroups, ...fromManual]
    .filter(m => m.days !== null)
    .sort((a, b) => a.days - b.days);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.display_name || !form.birthday_day || !form.birthday_month) {
      toast.error("Completa todos los campos");
      return;
    }
    addMutation.mutate(form);
  };

  return (
    <AppShell
      activeTab="banco"
      header={
        <PageHeader
          title="Banco de Cumpleaños"
          subtitle={`${allBirthdays.length} próximos`}
          backTo="/inicio"
          action={
            <Button
              size="sm"
              className="rounded-full px-4 h-9 font-black text-[10px] uppercase tracking-widest shadow-float"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancelar" : "Agregar"}
            </Button>
          }
        />
      }
    >
      <div className="space-y-4 pt-4">

        {/* Add Manual Birthday Form */}
        {showForm && (
          <Card className="p-5 space-y-4 border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="text-sm font-black text-text uppercase tracking-widest">Nuevo cumpleaños</h3>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <FormField label="Nombre">
                <Input
                  placeholder="Ej. Abuela María"
                  value={form.display_name}
                  onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Día">
                  <Input
                    type="number"
                    min="1" max="31"
                    placeholder="15"
                    value={form.birthday_day}
                    onChange={(e) => setForm(f => ({ ...f, birthday_day: e.target.value }))}
                  />
                </FormField>
                <FormField label="Mes">
                  <select
                    className="w-full h-11 rounded-2xl border border-border bg-surface px-3 text-sm font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={form.birthday_month}
                    onChange={(e) => setForm(f => ({ ...f, birthday_month: e.target.value }))}
                  >
                    <option value="">Mes</option>
                    {MONTHS.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <Button
                type="submit"
                size="pill"
                className="w-full font-black h-11"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? "Guardando..." : "Guardar cumpleaños"}
              </Button>
            </form>
          </Card>
        )}

        {/* Birthday List */}
        {allBirthdays.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="material-symbols-outlined text-text-muted/20 text-5xl">cake</span>
            <p className="text-text-muted italic text-sm">No hay próximos cumpleaños registrados.</p>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
              Agregar el primero
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {allBirthdays.map((profile) => (
              <Card
                key={profile.id}
                className="p-4 flex items-center gap-4 active:scale-[0.98] transition-all"
              >
                <div
                  className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    if (profile.type === "profile") navigate(`/perfil/${profile.id}`);
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar
                      name={profile.display_name}
                      url={profile.avatar_url}
                      className="size-14 ring-2 ring-primary/20"
                      ring={true}
                    />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 min-w-[1.5rem] h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-bg shadow-sm px-1.5",
                      profile.days === 0 ? "bg-success text-slate-900" : "bg-primary text-slate-900"
                    )}>
                      {profile.days === 0 ? "HOY" : `${profile.days}d`}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold text-text truncate">{profile.display_name}</h3>
                    <p className="text-xs text-text-muted">
                      {formatBirthdayDate(profile.birthday_day, profile.birthday_month)}
                    </p>
                    {profile.group_name && (
                      <p className="text-[10px] font-black text-primary/60 uppercase tracking-wider">{profile.group_name}</p>
                    )}
                    {profile.type === "manual" && (
                      <p className="text-[10px] font-black text-text-muted/40 uppercase tracking-wider">Manual</p>
                    )}
                  </div>
                </div>
                {profile.type === "manual" && (
                  <button
                    type="button"
                    className="flex-shrink-0 size-8 flex items-center justify-center rounded-full text-text-muted/40 hover:text-danger hover:bg-danger/10 transition-all"
                    onClick={() => deleteMutation.mutate(profile.manual_id)}
                  >
                    <span className="material-symbols-outlined text-[1.1rem]">delete</span>
                  </button>
                )}
                {profile.type === "profile" && (
                  <span
                    className="material-symbols-outlined text-text-muted/30 text-[1.2rem] cursor-pointer"
                    onClick={() => navigate(`/perfil/${profile.id}`)}
                  >
                    chevron_right
                  </span>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
