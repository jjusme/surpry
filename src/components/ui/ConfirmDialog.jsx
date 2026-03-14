import { Button } from "./Button";
import { Card } from "./Card";
import { cn } from "../../utils/cn";

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  variant = "primary",
  isLoading = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={!isLoading ? onCancel : undefined}
      />
      
      {/* Dialog */}
      <Card className="relative w-full max-w-xs animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300 shadow-float border-primary/20 p-6 space-y-6">
        <div className="space-y-2 text-center">
          <h3 className="text-xl font-black text-text tracking-tight uppercase">
            {title}
          </h3>
          <p className="text-sm text-text-muted leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant={variant}
            className="w-full h-12 font-bold"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Procesando..." : confirmLabel}
          </Button>
          <Button
            variant="ghost"
            className="w-full h-12 text-text-muted hover:text-text"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
