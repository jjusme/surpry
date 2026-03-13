import React from "react";
import { ErrorState } from "./ErrorState";

export class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught runtime error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-[100dvh] flex-col bg-bg">
                    <div className="flex flex-1 items-center justify-center p-6">
                        <ErrorState
                            title="¡Ups! Algo se rompió"
                            description="Ocurrió un error inesperado al mostrar esta pantalla."
                            onRetry={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                        />
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
