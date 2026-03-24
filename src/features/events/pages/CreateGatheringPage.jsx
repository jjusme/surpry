import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { FormField } from "../../../components/ui/FormField";
import { Select } from "../../../components/ui/Select";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { useAuth } from "../../auth/AuthContext";
import { listGroups } from "../../groups/service";
import { createGathering } from "../service";

export function CreateGatheringPage() {
  const [searchParams] = useSearchParams();
  const initialGroupId = searchParams.get("groupId") || "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();

  const [formData, setFormData] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    group_id: initialGroupId,
    virtual_participants: []
  });
  const [newVirtual, setNewVirtual] = useState("");

  const groupsQuery = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: () => listGroups(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });

  const mutation = useMutation({
    mutationFn: (values) => createGathering(values),
    onSuccess: (eventId) => {
      toast.success("¡Convivio creado!");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      navigate(`/eventos/${eventId}`);
    },
    onError: (error) => toast.error(error.message)
  });

  const addVirtual = () => {
    if (!newVirtual.trim()) return;
    setFormData(prev => ({
      ...prev,
      virtual_participants: [...prev.virtual_participants, newVirtual.trim()]
    }));
    setNewVirtual("");
  };

  const removeVirtual = (name) => {
    setFormData(prev => ({
      ...prev,
      virtual_participants: prev.virtual_participants.filter(n => n !== name)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("El título es obligatorio");
      return;
    }
    mutation.mutate({
      ...formData,
      group_id: formData.group_id || null
    });
  };

  if (groupsQuery.isLoading) return <LoadingState message="Cargando grupos..." fullScreen />;

  return (
    <AppShell
      activeTab="eventos"
      header={<PageHeader title="Nuevo Convivio" backTo="/eventos" />}
    >
      <div className="space-y-6 pt-4 pb-12">
        <Card className="p-6 space-y-6 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-text tracking-tight uppercase">Armar el plan</h3>
            <p className="text-sm font-medium text-text-muted leading-relaxed">
              Crea un evento para el grupo sin que sea un secreto. Perfectos para cenas, viajes o salidas.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Título del convivio">
              <Input
                placeholder="Ej. Cena Navideña, Viaje a la playa..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Fecha">
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </FormField>

              <FormField label="Grupo (Opcional)">
                <Select
                  value={formData.group_id}
                  onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                >
                  <option value="">Ninguno (Solo externos)</option>
                  {groupsQuery.data?.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-xs font-black uppercase tracking-widest text-text-muted">Participantes externos (Opcional)</p>
              <p className="text-[11px] text-text-muted leading-tight">Agregaremos a todos los del grupo, pero puedes sumar personas que no tengan la app (tú registrarás sus gastos).</p>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre del invitado"
                  value={newVirtual}
                  onChange={(e) => setNewVirtual(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVirtual())}
                />
                <Button type="button" variant="secondary" onClick={addVirtual} className="flex-shrink-0 size-11 p-0 rounded-2xl">
                  <span className="material-symbols-outlined">add</span>
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {formData.virtual_participants.map(name => (
                  <div key={name} className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold border border-primary/20 animate-in zoom-in duration-200">
                    {name}
                    <button type="button" onClick={() => removeVirtual(name)} className="size-4 flex items-center justify-center rounded-full bg-primary/20 hover:bg-primary/40 text-[14px]">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              size="pill"
              className="w-full font-black text-base h-12 shadow-float mt-4"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creando..." : "Crear Convivio"}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
