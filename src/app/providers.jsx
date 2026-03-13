import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../features/auth/AuthContext";
import { queryClient } from "../lib/queryClient";
import { GlobalErrorBoundary } from "../components/feedback/GlobalErrorBoundary";

export function AppProviders({ children }) {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '1rem',
              fontSize: '0.875rem',
              fontWeight: '600',
            },
            success: {
              iconTheme: { primary: 'var(--color-success)', secondary: '#1A1D1E' },
            },
            error: {
              iconTheme: { primary: 'var(--color-danger)', secondary: '#1A1D1E' },
            },
          }}
        />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
