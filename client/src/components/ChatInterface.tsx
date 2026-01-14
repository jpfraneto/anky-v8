import { useState, useRef, useEffect } from "react";
import { Message } from "../lib/api";
import TypingIndicator from "./TypingIndicator";
import MintActions from "./MintActions";

interface ChatInterfaceProps {
  messages: Message[];
  writingContent: string;
  imageUrl?: string | null;
  title?: string | null;
  isComplete: boolean;
  isGenerating: boolean;
  generationStep?: string;
  tokenUri?: string | null;
  conversationId?: string;
  onSendMessage: (message: string) => Promise<void>;
  onMint?: () => Promise<void>;
  onWriteAgain: () => void;
}

export default function ChatInterface({
  messages,
  writingContent,
  imageUrl,
  title,
  isComplete,
  isGenerating,
  generationStep,
  tokenUri,
  conversationId,
  onSendMessage,
  onMint,
  onWriteAgain,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const message = input.trim();
    setInput("");
    setSending(true);

    try {
      await onSendMessage(message);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* User's writing as first message */}
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-primary/20 text-fg rounded-2xl rounded-br-sm px-4 py-3">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {writingContent.length > 500
                ? writingContent.slice(0, 500) + "..."
                : writingContent}
            </p>
            <div className="text-xs text-muted mt-2 text-right">
              {writingContent.split(/\s+/).filter((w) => w).length} words
            </div>
          </div>
        </div>

        {/* Generation indicator */}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-2xl rounded-bl-sm px-4 py-3">
              <TypingIndicator text={generationStep || "Anky is reading..."} />
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary/20 text-fg rounded-br-sm"
                  : "bg-white/5 text-fg rounded-bl-sm"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </p>
              <div className="text-xs text-muted mt-2">
                {formatTime(msg.createdAt)}
              </div>
            </div>
          </div>
        ))}

        {/* Generated image */}
        {imageUrl && (
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-white/5 rounded-2xl rounded-bl-sm p-2">
              <img
                src={imageUrl}
                alt={title || "Generated Anky"}
                className="rounded-xl w-full max-w-md"
              />
              {title && (
                <p className="text-sm text-center text-primary mt-2 font-medium">
                  {title}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Mint actions */}
        {isComplete && !isGenerating && imageUrl && (
          <MintActions
            tokenUri={tokenUri}
            conversationId={conversationId}
            onMint={onMint}
          />
        )}

        {/* Sending indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-2xl rounded-bl-sm px-4 py-3">
              <TypingIndicator text="Anky is thinking..." />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Continue the conversation..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-fg placeholder:text-muted outline-none focus:border-primary/50 transition-colors"
            disabled={sending || isGenerating}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending || isGenerating}
            className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>

        {/* Write again button */}
        <button
          onClick={onWriteAgain}
          className="w-full mt-3 py-2 text-sm text-muted hover:text-fg transition-colors"
        >
          Write again
        </button>
      </div>
    </div>
  );
}
