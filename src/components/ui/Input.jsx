import { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const Input = forwardRef(function Input(
  { className, type = "text", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-12 w-full rounded-2xl border border-border bg-bg-elevated px-4 text-sm text-text placeholder:text-text-muted",
        className
      )}
      {...props}
    />
  );
});
