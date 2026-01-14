import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import ChatInterface from "../components/ChatInterface";
import { api, Conversation as ConversationType, Message } from "../lib/api";

export default function Conversation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authenticated } = usePrivy();
  const [conversation, setConversation] = useState<ConversationType | null>(
    null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!authenticated) {
      navigate("/");
      return;
    }

    if (!id) {
      navigate("/");
      return;
    }

    loadConversation();
  }, [id, authenticated, navigate]);

  async function loadConversation() {
    if (!id) return;

    setLoading(true);
    try {
      const { conversation } = await api.getConversation(id);
      setConversation(conversation);
      setMessages(conversation.messages);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      setError("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!id) return;

      // Optimistically add user message
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const { message: aiMessage } = await api.sendMessage(id, message);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== userMessage.id),
          { ...userMessage, id: `user-${Date.now()}` },
          aiMessage,
        ]);
      } catch (error) {
        console.error("Failed to send message:", error);
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      }
    },
    [id]
  );

  const handleWriteAgain = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading conversation...</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-danger">{error || "Conversation not found"}</div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <ChatInterface
      messages={messages}
      writingContent={conversation.writingSession.content}
      imageUrl={conversation.imageUrl}
      title={conversation.title}
      isComplete={conversation.writingSession.isComplete}
      isGenerating={false}
      tokenUri={conversation.tokenUri}
      conversationId={conversation.id}
      onSendMessage={handleSendMessage}
      onWriteAgain={handleWriteAgain}
    />
  );
}
