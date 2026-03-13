import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = "inbox"
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-5 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/12 text-primary">
        <span className="material-symbols-outlined text-[1.75rem]">{icon}</span>
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-text">{title}</h3>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </Card>
  );
}
