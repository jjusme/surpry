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
          position="top-center"
          gutter={8}
          toastOptions={{
            duration: 6000,
            style: {
              background: 'rgb(var(--color-bg-elevated))',
              color: 'rgb(var(--color-text))',
              border: '1px solid rgba(var(--color-border), 0.3)',
              borderRadius: '1.25rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              padding: '16px 24px',
              marginTop: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              zIndex: 99999,
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
