import React from "react";
import { Button } from "./Button";
import { cn } from "../../utils/cn";
import { formatCurrency } from "../../utils/format";

export function AiSuggestionCard({ title, reason, estimated_price, store, onSelect, isLoading }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <span className="material-symbols-outlined text-[1rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-text text-sm">{title}</p>
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{reason}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {estimated_price > 0 && (
            <span className="text-xs font-black text-primary">{formatCurrency(estimated_price)}</span>
          )}
          {store && (
            <span className="text-[10px] font-bold text-text-muted/60 uppercase">{store}</span>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => onSelect({ title, estimated_price, reason })} disabled={isLoading}>
          Elegir
        </Button>
      </div>
    </div>
  );
}
