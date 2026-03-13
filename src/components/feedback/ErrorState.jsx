import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function ErrorState({
  title = "Algo salio mal",
  description = "No pudimos cargar esta seccion.",
  onRetry,
  compact = false
}) {
  return (
    <Card
      className={compact ? "space-y-3 text-left" : "space-y-3 px-5 py-7 text-center"}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <span className="material-symbols-outlined">error</span>
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-text">{title}</h3>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      {onRetry ? <Button onClick={onRetry}>Intentar de nuevo</Button> : null}
    </Card>
  );
}
