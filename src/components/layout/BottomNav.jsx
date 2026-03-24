import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

const items = [
  { id: "inicio", label: "Inicio", to: "/inicio", icon: "home" },
  { id: "banco", label: "Banco", to: "/cumpleanios", icon: "cake" },
  { id: "grupos", label: "Grupos", to: "/grupos", icon: "groups" },
  { id: "eventos", label: "Eventos", to: "/eventos", icon: "celebration" },
  { id: "perfil", label: "Perfil", to: "/perfil", icon: "person" }
];

export function BottomNav({ activeTab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[30rem] items-center justify-around px-2 pb-5 pt-2">
        {items.map((item) => {
          const isActive = item.id === activeTab;

          return (
            <Link
              key={item.id}
              to={item.to}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-2xl px-4 py-2 text-[11px] font-semibold transition-all duration-200",
                isActive
                  ? "bg-primary/12 text-primary scale-105"
                  : "text-text-muted hover:text-text"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined transition-all duration-200",
                  isActive ? "text-[1.6rem]" : "text-[1.4rem]"
                )}
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className={cn("transition-all", isActive ? "font-bold" : "")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

