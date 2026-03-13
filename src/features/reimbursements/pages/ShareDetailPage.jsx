import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
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
  const queryClient = useQueryClient();
  const { isSupabaseConfigured } = useAuth();
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [serverError, setServerError] = useState("");
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
    },
    onError: (error) => setServerError(error.message)
  });
  const reviewMutation = useMutation({
    mutationFn: (action) => reviewShare(shareId, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["share-detail", shareId] });
    },
    onError: (error) => setServerError(error.message)
  });

  if (shareQuery.isLoading) {
    return <LoadingState message="Cargando pago..." fullScreen />;
  }

  if (shareQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar esta share"
          description={shareQuery.error.message}
          onRetry={shareQuery.refetch}
        />
      </div>
    );
  }

  const share = shareQuery.data;

  return (
    <AppShell
      activeTab="eventos"
      header={<PageHeader title="Detalle de pago" backTo={`/eventos/${share?.event_id || ""}`} />}
    >
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-text">{formatCurrency(share?.amount_due)}</h2>
            <p className="text-sm text-text-muted">{share?.expense_title || "Share"}</p>
          </div>
          <StatusBadge status={share?.status}>{share?.status}</StatusBadge>
        </div>

        <Card className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Enviar pago a</p>
          <div className="space-y-2">
            <p className="text-lg font-bold text-text">{share?.destination_account_holder || "Sin titular"}</p>
            <p className="text-sm text-text-muted">{share?.destination_bank_name || "Sin banco"}</p>
            <p className="text-sm text-text-muted">Metodo: {share?.destination_type || "Sin metodo"}</p>
            <p className="text-sm font-semibold text-primary-strong break-all">{share?.destination_value || "No disponible"}</p>
            {share?.destination_note ? <p className="text-sm text-text-muted">{share.destination_note}</p> : null}
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-text">Reportar pago</h3>
            <p className="text-sm text-text-muted">Marca cuando ya transferiste y sube comprobante si aplica.</p>
          </div>
          <TextArea rows={3} placeholder="Nota opcional" value={note} onChange={(event) => setNote(event.target.value)} />
          <Input type="file" onChange={(event) => setProofFile(event.target.files?.[0] || null)} />
          {serverError ? <p className="text-sm font-medium text-danger">{serverError}</p> : null}
          <Button className="w-full" size="lg" onClick={() => reportMutation.mutate()} disabled={reportMutation.isPending}>
            {reportMutation.isPending ? "Enviando..." : "Confirmar transferencia enviada"}
          </Button>
        </Card>

        {share?.can_review ? (
          <Card className="space-y-3">
            <h3 className="text-lg font-bold text-text">Revision</h3>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => reviewMutation.mutate("confirmed")}>
                Confirmar pago
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => reviewMutation.mutate("rejected")}>
                Rechazar
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
