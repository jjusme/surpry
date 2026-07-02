import React, { useEffect } from "react";

export function BottomSheet({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[30rem] rounded-t-3xl bg-bg shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          {title ? <h3 className="text-base font-black text-text">{title}</h3> : <span />}
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-text-muted hover:text-text transition-colors"
          >
            <span className="material-symbols-outlined text-[1.1rem]">close</span>
          </button>
        </div>
        <div className="px-6 pb-10">
          {children}
        </div>
      </div>
    </div>
  );
}
