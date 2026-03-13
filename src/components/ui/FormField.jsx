import { cn } from "../../utils/cn";

export function FormField({ label, hint, error, children, className }) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-semibold text-text">{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
