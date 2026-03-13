import { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { LoadingState } from "../components/feedback/LoadingState";
import { ProtectedRoute, PublicOnlyRoute } from "./guards";
import { AuthLayout } from "../features/auth/AuthLayout";

function lazyPage(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

function withSuspense(element) {
  return (
    <Suspense fallback={<LoadingState message="Cargando pantalla..." fullScreen />}>
      {element}
    </Suspense>
  );
}

const ForgotPasswordPage = lazyPage(() => import("../features/auth/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const LoginPage = lazyPage(() => import("../features/auth/pages/LoginPage"), "LoginPage");
const RegisterPage = lazyPage(() => import("../features/auth/pages/RegisterPage"), "RegisterPage");
const HomePage = lazyPage(() => import("../features/home/pages/HomePage"), "HomePage");
const EventsListPage = lazyPage(() => import("../features/events/pages/EventsListPage"), "EventsListPage");
const EventDetailPage = lazyPage(() => import("../features/events/pages/EventDetailPage"), "EventDetailPage");
const GroupsListPage = lazyPage(() => import("../features/groups/pages/GroupsListPage"), "GroupsListPage");
const GroupDetailPage = lazyPage(() => import("../features/groups/pages/GroupDetailPage"), "GroupDetailPage");
const JoinGroupPage = lazyPage(() => import("../features/groups/pages/JoinGroupPage"), "JoinGroupPage");
const ProfileSetupPage = lazyPage(() => import("../features/profile/pages/ProfileSetupPage"), "ProfileSetupPage");
const PaymentMethodsPage = lazyPage(() => import("../features/profile/pages/PaymentMethodsPage"), "PaymentMethodsPage");
const ProfilePage = lazyPage(() => import("../features/profile/pages/ProfilePage"), "ProfilePage");
const ShareDetailPage = lazyPage(() => import("../features/reimbursements/pages/ShareDetailPage"), "ShareDetailPage");
const WishlistPage = lazyPage(() => import("../features/wishlist/pages/WishlistPage"), "WishlistPage");

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/inicio" replace />
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: withSuspense(<LoginPage />) },
          { path: "/registro", element: withSuspense(<RegisterPage />) },
          { path: "/recuperar", element: withSuspense(<ForgotPasswordPage />) }
        ]
      }
    ]
  },
  {
    path: "/join/:token",
    element: withSuspense(<JoinGroupPage />)
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/setup", element: withSuspense(<ProfileSetupPage />) },
      { path: "/onboarding", element: <Navigate to="/setup" replace /> },
      { path: "/inicio", element: withSuspense(<HomePage />) },
      { path: "/grupos", element: withSuspense(<GroupsListPage />) },
      { path: "/grupos/:groupId", element: withSuspense(<GroupDetailPage />) },
      { path: "/eventos", element: withSuspense(<EventsListPage />) },
      { path: "/eventos/:eventId", element: withSuspense(<EventDetailPage />) },
      { path: "/wishlist", element: withSuspense(<WishlistPage />) },
      { path: "/perfil", element: withSuspense(<ProfilePage />) },
      { path: "/perfil/metodos", element: withSuspense(<PaymentMethodsPage />) },
      { path: "/shares/:shareId", element: withSuspense(<ShareDetailPage />) }
    ]
  },
  {
    path: "*",
    element: <Navigate to="/inicio" replace />
  }
]);