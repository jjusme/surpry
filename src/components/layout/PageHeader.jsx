import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

export function PageHeader({
  title,
  subtitle,
  backTo,
  action,
  sticky = true,
  compact = false
}) {
  return (
    <header
      className={cn(
        "z-20 border-b border-border bg-bg/90 backdrop-blur-md",
        sticky && "sticky top-0",
        compact ? "px-4 py-3" : "px-4 py-4"
      )}
    >
      <div className="mx-auto flex max-w-[30rem] items-center gap-3">
        {backTo ? (
          <Link
            to={backTo}
            className="flex size-10 items-center justify-center rounded-full bg-surface text-text shadow-card"
          >
            <span className="material-symbols-outlined text-[1.25rem]">
              arrow_back
            </span>
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          {subtitle ? (
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
              {subtitle}
            </p>
          ) : null}
          <h1 className="truncate text-lg font-bold text-text">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}
