import { useState } from "react";
import { Button } from "./Button";
import { cn } from "../../utils/cn";

const SLIDES = [
    {
        icon: "celebration",
        title: "¡Bienvenido a Surpry!",
        description: "La app para planear los mejores momentos secretos. Sin spoilers, sin avisos al cumpleañero."
    },
    {
        icon: "groups_3",
        title: "Crea tu círculo",
        description: "Arma un grupo con tus amigos o familia. El link de invitación es tu pase de acceso secreto."
    },
    {
        icon: "volunteer_activism",
        title: "Cómplice, no solo invitado",
        description: "Cualquier miembro puede proponer ideas, votar por el mejor regalo y dividir gastos fácilmente."
    },
    {
        icon: "auto_fix_high",
        title: "Magia en secreto",
        description: "Todo sucede tras bambalinas. El cumpleañero solo verá la sorpresa final."
    }
];

export function WelcomeWizard({ onComplete }) {
    const [currentSlide, setCurrentSlide] = useState(0);

    const handleNext = () => {
        if (currentSlide < SLIDES.length - 1) {
            setCurrentSlide(currentSlide + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg p-4 animate-in fade-in duration-500">
            <div className="flex h-full w-full max-w-[28rem] flex-col items-center justify-between py-12 px-6">
                {/* Progress dots */}
                <div className="flex gap-2">
                    {SLIDES.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                i === currentSlide ? "w-8 bg-primary" : "w-1.5 bg-surface-muted"
                            )}
                        />
                    ))}
                </div>

                {/* Slide content */}
                <div key={currentSlide} className="flex flex-col items-center text-center animate-in zoom-in slide-in-from-bottom-8 duration-500">
                    <div className="mb-8 flex size-32 items-center justify-center rounded-[2.5rem] bg-primary/10 shadow-float">
                        <span
                            className="material-symbols-outlined text-[4.5rem] text-primary"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            {SLIDES[currentSlide].icon}
                        </span>
                    </div>
                    <h2 className="mb-4 text-3xl font-black text-text">{SLIDES[currentSlide].title}</h2>
                    <p className="text-lg leading-relaxed text-text-muted">
                        {SLIDES[currentSlide].description}
                    </p>
                </div>

                {/* Actions */}
                <div className="w-full space-y-3">
                    <Button size="pill" className="w-full text-lg font-black h-16 shadow-lg active:scale-95 transition-all" onClick={handleNext}>
                        {currentSlide === SLIDES.length - 1 ? "¡Empezar ahora!" : "Continúa"}
                    </Button>
                    {currentSlide < SLIDES.length - 1 && (
                        <button
                            onClick={onComplete}
                            className="w-full py-2 text-sm font-bold text-text-muted/60 active:opacity-50 transition-opacity"
                        >
                            Saltar introducción
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
