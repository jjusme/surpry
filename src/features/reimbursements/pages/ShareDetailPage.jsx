import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { TextArea } from "../../../components/ui/TextArea";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useAuth } from "../../auth/AuthContext";
import {
  getShareDetail,
  reportSharePaid,
  reviewShare,
  uploadPrivateFile
} from "../../events/service";
import { formatCurrency } from "../../../utils/format";

export function ShareDetailPage() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSupabaseConfigured } = useAuth();
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const shareQuery = useQuery({
    queryKey: ["share-detail", shareId],
    queryFn: () => getShareDetail(shareId),
    enabled: Boolean(shareId && isSupabaseConfigured)
  });
  const reportMutation = useMutation({
    mutationFn: async () => {
      let proofPath = null;

      if (proofFile) {
        proofPath = await uploadPrivateFile(
          "payment-proofs",
          `shares/${shareId}/${crypto.randomUUID()}-${proofFile.name}`,
          proofFile
        );
      }

      return reportSharePaid(shareId, {
        note,
        proof_path: proofPath
      });
    },
    onSuccess: async () => {
      setNote("");
      setProofFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["share-detail", shareId] }),
        queryClient.invalidateQueries({ queryKey: ["pending-shares"] })
      ]);
      toast.success("Pago reportado con éxito");
    },
    onError: (error) => toast.error(error.message)
  });
  const reviewMutation = useMutation({
    mutationFn: (action) => reviewShare(shareId, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["share-detail", shareId] });
      toast.success("Pago revisado");
    },
    onError: (error) => toast.error(error.message)
  });

  if (shareQuery.isLoading) {
    return <LoadingState message="Cargando pago..." fullScreen />;
  }

  if (shareQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar este pago"
          description={shareQuery.error.message}
          onRetry={shareQuery.refetch}
        />
      </div>
    );
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  const share = shareQuery.data;

  return (
    <AppShell
      activeTab="eventos"
      header={<PageHeader title="Detalle de pago" backTo={share?.event_id ? `/eventos/${share.event_id}` : "/inicio"} />}
    >
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-text">{formatCurrency(share?.amount_due)}</h2>
            <p className="text-sm text-text-muted">{share?.expense_title || "Pago"}</p>
          </div>
          <StatusBadge status={share?.status} />
        </div>

        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <span
                className="material-symbols-outlined text-primary text-[1.25rem]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {share?.destination_type === 'card' ? 'credit_card' :
                 share?.destination_type === 'clabe' ? 'account_balance' :
                 share?.destination_type === 'alias' ? 'tag' :
                 'payments'}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Enviar pago a</p>
              <p className="text-sm font-bold text-text">{share?.destination_account_holder || 'Sin titular'}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-text-muted">Banco: <span className="text-text font-medium">{share?.destination_bank_name || "Sin banco"}</span></p>
            <p className="text-sm text-text-muted">Método: <span className="text-text font-medium uppercase">{share?.destination_type || "Sin método"}</span></p>
            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-surface-muted/30 border border-primary/10">
              <span className="text-sm font-bold text-primary-strong break-all select-all">{share?.destination_value || "No disponible"}</span>
              <button
                onClick={() => copyToClipboard(share?.destination_value)}
                className="flex-shrink-0 size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center active:scale-90 transition-transform"
                title="Copiar"
              >
                <span className="material-symbols-outlined text-[1.25rem]">content_copy</span>
              </button>
            </div>
            {share?.destination_note ? <p className="text-sm text-text-muted">{share.destination_note}</p> : null}
          </div>
        </Card>

        {share?.status === 'pending' || share?.status === 'rejected' ? (
          <Card className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div>
              <h3 className="text-lg font-bold text-text">Reportar pago</h3>
              <p className="text-sm text-text-muted">Marca cuando ya transferiste y sube comprobante si aplica.</p>
            </div>
            {share?.status === 'rejected' && (
              <div className="rounded-2xl bg-danger/10 p-4 border border-danger/20">
                <p className="text-xs font-bold text-danger uppercase tracking-wider mb-1">Pago rechazado</p>
                <p className="text-xs text-danger/80 italic">"Revisa los datos de transferencia o el comprobante y vuelve a intentarlo."</p>
              </div>
            )}
            <TextArea rows={3} placeholder="Nota opcional (ej. 'Ya deposité')" value={note} onChange={(event) => setNote(event.target.value)} />
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Comprobante (Opcional)</p>
              <Input type="file" className="p-2 h-auto text-xs" onChange={(event) => setProofFile(event.target.files?.[0] || null)} />
            </div>
            <Button className="w-full h-14 text-lg font-black shadow-lg shadow-primary/20" size="lg" onClick={() => reportMutation.mutate()} disabled={reportMutation.isPending}>
              {reportMutation.isPending ? "Reportando..." : "Confirmar enviada"}
            </Button>
          </Card>
        ) : share?.status === 'reported_paid' ? (
          <Card className="bg-surface-muted/30 border-dashed p-8 text-center space-y-4 animate-in zoom-in duration-500">
            <div className="size-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-primary text-3xl">hourglass_empty</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-text">Pago en revisión</h3>
              <p className="text-sm text-text-muted">Ya reportaste este pago. Avisaremos cuando el cómplice lo confirme.</p>
            </div>
          </Card>
        ) : (
          <Card className="bg-success/10 border-success/20 p-8 text-center space-y-4 animate-in zoom-in duration-500">
            <div className="size-16 bg-success text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-success/20">
              <span className="material-symbols-outlined text-3xl">check</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-success">¡Pago Confirmado!</h2>
              <p className="text-sm text-success/70 font-medium">Gracias por tu aporte a la sorpresa.</p>
            </div>
          </Card>
        )}

        {share?.can_review && share?.status === 'reported_paid' ? (
          <Card className="space-y-4 border-l-4 border-primary p-5 animate-in slide-in-from-right-4 duration-500">
            <h3 className="text-lg font-black text-text uppercase tracking-tight">Cómplice: Revisa este pago</h3>
            <p className="text-xs text-text-muted italic">"Confirma si ya viste reflejado el dinero en tu cuenta."</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1 h-12 font-black" onClick={() => reviewMutation.mutate("confirmed")}>
                Lo recibí
              </Button>
              <Button variant="ghost" className="border border-danger/20 text-danger hover:bg-danger/5 h-12 font-black" onClick={() => reviewMutation.mutate("rejected")}>
                No lo recibí
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
