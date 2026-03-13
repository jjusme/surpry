import { cn } from "../../utils/cn";

export function LoadingState({ message = "Cargando...", fullScreen = false }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-10 text-center text-text-muted",
        fullScreen && "min-h-screen bg-bg px-6"
      )}
    >
      <div className="size-12 animate-spin rounded-full border-4 border-primary/15 border-t-primary" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
