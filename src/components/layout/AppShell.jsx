import { BottomNav } from "./BottomNav";
import { cn } from "../../utils/cn";

export function AppShell({
  children,
  activeTab,
  header,
  className,
  hideNav = false
}) {
  return (
    <div className={cn("app-frame", className)}>
      {header}
      <main className="px-4 pb-8">{children}</main>
      {!hideNav && <BottomNav activeTab={activeTab} />}
    </div>
  );
}
