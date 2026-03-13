import { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const TextArea = forwardRef(function TextArea(
  { className, rows = 4, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-2xl border border-border bg-bg-elevated px-4 py-3 text-sm text-text placeholder:text-text-muted",
        className
      )}
      {...props}
    />
  );
});
