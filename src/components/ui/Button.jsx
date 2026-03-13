import { cn } from "../../utils/cn";

const variants = {
  primary:
    "bg-primary text-slate-950 shadow-float hover:bg-primary-strong active:scale-[0.99]",
  secondary:
    "bg-surface text-text shadow-card hover:bg-surface-muted active:scale-[0.99]",
  ghost: "bg-transparent text-text hover:bg-surface-muted",
  danger: "bg-danger text-white hover:opacity-90"
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" && "h-12 px-5 text-sm",
        size === "lg" && "h-14 px-6 text-base",
        size === "icon" && "size-11",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
