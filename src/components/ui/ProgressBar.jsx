import { cn } from "../../utils/cn";

/**
 * ProgressBar — teal filled bar on a muted track.
 * @param {number} value  0–100
 * @param {string} label  left label
 * @param {string} rightLabel  right label
 * @param {string} className
 */
export function ProgressBar({ value = 0, label, rightLabel, className }) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || rightLabel) && (
        <div className="flex items-center justify-between">
          {label && (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
              {label}
            </p>
          )}
          {rightLabel && (
            <p className="text-xs font-bold text-text">{rightLabel}</p>
          )}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
