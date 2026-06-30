import React, { useMemo, useState } from "react";
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
import {
  daysUntilBirthday,
  formatBirthday,
  getBirthdayCountdownLabel,
  getBirthdaySectionLabel
} from "../../../utils/format";
import { cn } from "../../../utils/cn";

async function listManualBirthdays(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("manual_birthdays")
    .select("*")
    .eq("user_id", userId)
    .order("birthday_month", { ascending: true })
    .order("birthday_day", { ascending: true });

  if (error) {
    throw error;
  }

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

  if (error) {
    throw error;
  }

  return data;
}

async function deleteManualBirthday(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("manual_birthdays").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const SECTION_ORDER = [
  "Hoy",
  "Mañana",
  "Esta semana",
  "Próximamente",
  "Más adelante"
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
    onSuccess: async () => {
      toast.success("Cumpleaños guardado");
      setForm({ display_name: "", birthday_day: "", birthday_month: "" });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["manual-birthdays", user.id] });
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: deleteManualBirthday,
    onSuccess: async () => {
      toast.success("Cumpleaños eliminado");
      await queryClient.invalidateQueries({ queryKey: ["manual-birthdays", user.id] });
    },
    onError: (error) => toast.error(error.message)
  });

  const fromGroups = (groupsQuery.data || []).flatMap((group) =>
    (group.members || [])
      .filter((member) => member.user_id !== user?.id && member.profiles?.birthday_day)
      .map((member) => ({
        id: member.profiles.id,
        display_name: member.profiles.display_name,
        avatar_url: member.profiles.avatar_url,
        birthday_day: member.profiles.birthday_day,
        birthday_month: member.profiles.birthday_month,
        days: daysUntilBirthday(member.profiles.birthday_day, member.profiles.birthday_month),
        type: "profile",
        sourceLabel: group.name
      }))
  );

  const uniqueFromGroups = Array.from(new Map(fromGroups.map((item) => [item.id, item])).values());

  const fromManual = (manualQuery.data || []).map((item) => ({
    id: `manual_${item.id}`,
    manual_id: item.id,
    display_name: item.display_name,
    avatar_url: null,
    birthday_day: item.birthday_day,
    birthday_month: item.birthday_month,
    days: daysUntilBirthday(item.birthday_day, item.birthday_month),
    type: "manual",
    sourceLabel: "Guardado por ti"
  }));

  const allBirthdays = [...uniqueFromGroups, ...fromManual]
    .filter((item) => item.days !== null)
    .sort((a, b) => a.days - b.days || a.display_name.localeCompare(b.display_name));

  const groupedBirthdays = useMemo(() => {
    const buckets = allBirthdays.reduce((acc, item) => {
      const section = getBirthdaySectionLabel(item.days);
      if (!acc[section]) {
        acc[section] = [];
      }

      acc[section].push(item);
      return acc;
    }, {});

    return SECTION_ORDER
      .filter((section) => buckets[section]?.length)
      .map((section) => ({ section, items: buckets[section] }));
  }, [allBirthdays]);

  if (groupsQuery.isLoading || manualQuery.isLoading) {
    return <LoadingState message="Cargando cumpleaños..." fullScreen />;
  }

  if (groupsQuery.isError || manualQuery.isError) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar los cumpleaños"
          description={groupsQuery.error?.message || manualQuery.error?.message}
          onRetry={() => {
            groupsQuery.refetch();
            manualQuery.refetch();
          }}
        />
      </div>
    );
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.display_name || !form.birthday_day || !form.birthday_month) {
      toast.error("Completa todos los campos");
      return;
    }

    addMutation.mutate(form);
  };

  return (
    <AppShell
      activeTab="cumpleanios"
      header={(
        <PageHeader
          title="Próximos cumpleaños"
          subtitle={`${allBirthdays.length} fechas por cuidar`}
          backTo="/inicio"
          action={(
            <Button
              size="sm"
              className="h-9 rounded-full px-4 text-[10px] font-black uppercase tracking-widest shadow-float"
              onClick={() => setShowForm((value) => !value)}
            >
              {showForm ? "Cancelar" : "Agregar"}
            </Button>
          )}
        />
      )}
    >
      <div className="space-y-5 pt-4">
        {showForm && (
          <Card className="space-y-4 border-primary/20 p-5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-text">
                Nuevo cumpleaños
              </h3>
              <p className="text-sm text-text-muted">
                Guarda familiares o personas fuera de la app para no perderles la pista.
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <FormField label="Nombre">
                <Input
                  placeholder="Ej. Abuela María"
                  value={form.display_name}
                  onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Día">
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="15"
                    value={form.birthday_day}
                    onChange={(event) => setForm((current) => ({ ...current, birthday_day: event.target.value }))}
                  />
                </FormField>

                <FormField label="Mes">
                  <select
                    className="h-11 w-full rounded-2xl border border-border bg-surface px-3 text-sm font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={form.birthday_month}
                    onChange={(event) => setForm((current) => ({ ...current, birthday_month: event.target.value }))}
                  >
                    <option value="">Mes</option>
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <Button
                type="submit"
                size="pill"
                className="h-11 w-full font-black"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? "Guardando..." : "Guardar cumpleaños"}
              </Button>
            </form>
          </Card>
        )}

        {allBirthdays.length === 0 ? (
          <Card className="space-y-4 border-dashed p-10 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-[1.5rem] bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                cake
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-base font-black text-text">Aún no tienes cumpleaños próximos</p>
              <p className="text-sm leading-relaxed text-text-muted">
                Aquí vas a ver a quién conviene empezar a organizarle algo desde ya.
              </p>
            </div>
            <Button variant="secondary" size="pill" className="mx-auto max-w-xs" onClick={() => setShowForm(true)}>
              Agregar el primero
            </Button>
          </Card>
        ) : (
          groupedBirthdays.map(({ section, items }) => (
            <section key={section} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">
                  {section}
                </h3>
                <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
                  {items.length}
                </span>
              </div>

              <div className="space-y-3">
                {items.map((profile) => (
                  <Card
                    key={profile.id}
                    className={cn(
                      "space-y-3 p-4 transition-all",
                      profile.type === "profile" && "cursor-pointer active:scale-[0.99]"
                    )}
                    onClick={() => {
                      if (profile.type === "profile") {
                        navigate(`/perfil/${profile.id}`);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={profile.display_name}
                        url={profile.avatar_url}
                        className="size-14 shadow-card"
                        ring
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-black text-text">
                            {profile.display_name}
                          </p>
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
                            {profile.type === "manual" ? "Manual" : "Grupo"}
                          </span>
                        </div>
                        <p className="text-sm text-text-muted">
                          {formatBirthday(profile.birthday_day, profile.birthday_month)}
                        </p>
                        <p className="truncate text-xs font-bold text-primary/80">
                          {profile.sourceLabel}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "rounded-2xl px-3 py-2 text-center text-xs font-black uppercase tracking-[0.15em]",
                          profile.days === 0
                            ? "bg-success/15 text-success"
                            : "bg-primary/12 text-primary-strong"
                        )}
                      >
                        {getBirthdayCountdownLabel(profile.days)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/60 pt-3">
                      {profile.type === "profile" ? (
                        <span className="text-xs font-bold text-text-muted">
                          Toca revisar su perfil y wishlist
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-text-muted">
                          Puedes eliminarlo cuando ya no haga falta
                        </span>
                      )}

                      {profile.type === "manual" ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-danger transition-colors hover:bg-danger/5"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteMutation.mutate(profile.manual_id);
                          }}
                        >
                          <span className="material-symbols-outlined text-[1rem]">delete</span>
                          Eliminar
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.15em] text-primary">
                          Ver perfil
                          <span className="material-symbols-outlined text-[1rem]">chevron_right</span>
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
