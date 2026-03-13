import { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const Select = forwardRef(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-border bg-bg-elevated px-4 text-sm text-text",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
