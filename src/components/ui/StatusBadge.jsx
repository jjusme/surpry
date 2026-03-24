import { cn } from "../../utils/cn";

const styles = {
  draft: "bg-surface-muted text-text-muted",
  active: "bg-primary/15 text-primary-strong",
  completed: "bg-success/15 text-success",
  cancelled: "bg-danger/15 text-danger",
  pending: "bg-warning/15 text-warning",
  reported_paid: "bg-primary/15 text-primary-strong",
  confirmed: "bg-success/15 text-success",
  rejected: "bg-danger/15 text-danger"
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-[11px]",
  lg: "px-4 py-1.5 text-[12px]",
};

const translations = {
  draft: "Borrador",
  active: "En marcha",
  completed: "Finalizado",
  cancelled: "Cancelado",
  pending: "Pendiente",
  reported_paid: "En revisión",
  confirmed: "Confirmado",
  rejected: "Rechazado",
  proposed: "Propuesta",
  gathering: "Recopilando"
};

export function StatusBadge({ status, children, className, size = "md" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full font-bold uppercase tracking-[0.2em]",
        sizeStyles[size],
        styles[status] || "bg-surface-muted text-text-muted",
        className
      )}
    >
      {children || translations[status] || status}
    </span>
  );
}
