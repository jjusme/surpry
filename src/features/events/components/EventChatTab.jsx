import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "../../auth/AuthContext";
import { listEventMessages, sendEventMessage } from "../service";
import { Avatar } from "../../../components/ui/Avatar";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { cn } from "../../../utils/cn";

export function EventChatTab({ eventId }) {
    const { user, isSupabaseConfigured } = useAuth();
    const queryClient = useQueryClient();
    const scrollRef = useRef(null);
    const [message, setMessage] = useState("");

    const chatQuery = useQuery({
        queryKey: ["event-messages", eventId],
        queryFn: () => listEventMessages(eventId),
        enabled: Boolean(eventId && isSupabaseConfigured),
        refetchInterval: false // Handled by realtime in parent
    });

    const sendMutation = useMutation({
        mutationFn: (msg) => sendEventMessage(eventId, msg, user.id),
        onSuccess: () => {
            setMessage("");
            queryClient.invalidateQueries({ queryKey: ["event-messages", eventId] });
        }
    });

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatQuery.data]);

    if (chatQuery.isLoading) return <LoadingState message="Cargando chat..." />;
    if (chatQuery.error) return <ErrorState title="Error" description={chatQuery.error.message} onRetry={chatQuery.refetch} />;

    const messages = chatQuery.data || [];

    const handleSend = (e) => {
        e.preventDefault();
        if (!message.trim() || sendMutation.isPending) return;
        sendMutation.mutate(message);
    };

    return (
        <div className="flex flex-col h-[60vh] bg-bg rounded-3xl overflow-hidden border border-surface">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
            >
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <EmptyState
                            icon="forum"
                            title="Chat de Cómplices"
                            description="Escribe el primer mensaje para coordinar la sorpresa con los demás organizadores. El cumpleañero no verá esto."
                        />
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.user_id === user.id;
                        return (
                            <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <div className={cn("flex items-end gap-2 max-w-[85%]", isMe && "flex-row-reverse")}>
                                    {!isMe && (
                                        <Avatar
                                            name={msg.profiles?.display_name || "Usuario"}
                                            url={msg.profiles?.avatar_url}
                                            className="size-6 flex-shrink-0 mb-1"
                                        />
                                    )}
                                    <div className={cn(
                                        "px-4 py-2 rounded-2xl",
                                        isMe ? "bg-primary text-primary-content rounded-br-sm" : "bg-surface text-text rounded-bl-sm shadow-sm"
                                    )}>
                                        {!isMe && <p className="text-[10px] font-bold opacity-70 mb-0.5">{msg.profiles?.display_name || "Usuario"}</p>}
                                        <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] text-text-muted mt-1 px-8 opacity-70">
                                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: es })}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="p-3 bg-surface border-t border-bg">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 rounded-full bg-bg border-none px-4"
                        disabled={sendMutation.isPending}
                        autoComplete="off"
                    />
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        className="rounded-full size-10 p-0 flex-shrink-0 flex items-center justify-center"
                        disabled={!message.trim() || sendMutation.isPending}
                    >
                        <span className="material-symbols-outlined text-[1.2rem]">send</span>
                    </Button>
                </form>
            </div>
        </div>
    );
}
