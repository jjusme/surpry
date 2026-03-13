import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="app-frame flex items-center px-4">
      <div className="w-full space-y-6">
        <Outlet />
      </div>
    </div>
  );
}
