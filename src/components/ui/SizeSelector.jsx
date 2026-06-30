import React from "react";
import { cn } from "../../utils/cn";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export function SizeSelector({ value, onChange, label, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">{label}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onChange(value === size ? "" : size)}
            className={cn(
              "h-10 min-w-[2.75rem] rounded-xl px-3 text-sm font-bold transition-all border",
              value === size
                ? "bg-primary text-slate-950 border-primary shadow-float"
                : "bg-bg-elevated text-text border-border hover:border-primary/50"
            )}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
