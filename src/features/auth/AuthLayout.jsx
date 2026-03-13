import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div
      className="app-frame flex items-center px-4"
      style={{
        background: "linear-gradient(160deg, rgb(var(--color-bg)) 0%, rgb(var(--color-surface-muted)) 100%)"
      }}
    >
      <div className="w-full space-y-6 py-12">
        <Outlet />
      </div>
    </div>
  );
}

