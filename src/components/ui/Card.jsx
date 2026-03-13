import { cn } from "../../utils/cn";

export function Card({ children, className }) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-border bg-surface p-4 shadow-card",
        className
      )}
    >
      {children}
    </section>
  );
}
