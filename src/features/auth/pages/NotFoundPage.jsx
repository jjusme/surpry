import React from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <AppShell hideNav header={<PageHeader />}>
      <div className="flex flex-col items-center justify-center gap-6 py-24 text-center px-6">
        <span className="material-symbols-outlined text-[4rem] text-primary/30" style={{ fontVariationSettings: "'FILL' 1" }}>
          search_off
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-text">Página no encontrada</h1>
          <p className="text-sm text-text-muted">El enlace puede estar roto o la página ya no existe.</p>
        </div>
        <Button size="pill" className="px-8" onClick={() => navigate("/inicio")}>
          Ir al inicio
        </Button>
      </div>
    </AppShell>
  );
}
