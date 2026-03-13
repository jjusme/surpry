import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

const items = [
  { id: "inicio", label: "Inicio", to: "/inicio", icon: "home" },
  { id: "grupos", label: "Grupos", to: "/grupos", icon: "groups" },
  { id: "eventos", label: "Eventos", to: "/eventos", icon: "celebration" },
  { id: "perfil", label: "Perfil", to: "/perfil", icon: "person" }
];

export function BottomNav({ activeTab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg/95 px-4 pb-5 pt-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-[30rem] items-center justify-between gap-2">
        {items.map((item) => {
          const isActive = item.id === activeTab;

          return (
            <Link
              key={item.id}
              to={item.to}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors",
                isActive ? "text-primary" : "text-text-muted"
              )}
            >
              <span className="material-symbols-outlined text-[1.5rem]">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
