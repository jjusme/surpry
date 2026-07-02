import React from "react";
import { Link } from "react-router-dom";
import { BrandAsset } from "../ui/BrandAsset";
import { cn } from "../../utils/cn";

export function PageHeader({
  title,
  subtitle,
  backTo,
  action,
  sticky = true,
  compact = false
}) {
  const hasTitleRow = Boolean(title || subtitle);

  return (
    <header
      className={cn(
        "z-20 border-b border-border bg-surface px-4 py-4",
        sticky && "sticky top-0"
      )}
    >
      <div className={cn("mx-auto max-w-[30rem]", compact ? "space-y-2" : "space-y-3")}>
        <div className="flex items-center gap-3">
          {backTo ? (
            <Link
              to={backTo}
              className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-surface text-text shadow-card"
            >
              <span className="material-symbols-outlined text-[1.25rem]">arrow_back</span>
            </Link>
          ) : null}
          <BrandAsset variant="logo" className="h-12 w-auto max-w-[12rem]" />
          {action ? <div className="ml-auto flex items-center">{action}</div> : null}
        </div>

        {hasTitleRow ? (
          <div className="min-w-0">
            {subtitle ? (
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
                {subtitle}
              </p>
            ) : null}
            {title ? <h1 className="truncate text-lg font-bold text-text">{title}</h1> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
