import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import WritingArea from "../components/WritingArea";
import ChatInterface from "../components/ChatInterface";
import { useWritingSession } from "../hooks/useWritingSession";
import { api, Message } from "../lib/api";

type ViewState = "writing" | "chat";

export default function Home() {
  const navigate = useNavigate();
  const { authenticated, login } = usePrivy();
  const [view, setView] = useState<ViewState>("writing");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>();
  const [imageUrl, setImageUrl] = useState<string>();
  const [title, setTitle] = useState<string>();
  const [tokenUri, setTokenUri] = useState<string>();

  const session = useWritingSession();

  const handleSessionEnd = useCallback(async () => {
    if (!session.content.trim()) {
      return;
    }

    if (!authenticated) {
      // Prompt login
      login();
      return;
    }

    session.endSession();
    setView("chat");
    setIsGenerating(true);

    try {
      // Create session in database
      setGenerationStep("Saving your writing...");
      const { session: savedSession } = await api.createSession({
        content: session.content,
        duration: session.stats.duration,
        wordCount: session.stats.wordCount,
        wpm: session.stats.wpm,
        backspaceCount: session.stats.backspaceCount,
        enterCount: session.stats.enterCount,
        arrowCount: session.stats.arrowCount,
      });

      if (session.isComplete) {
        // Full generation for 8+ minute sessions
        setGenerationStep("Anky is reading your words...");
        const result = await api.generateFull(
          savedSession.id,
          navigator.language
        );

        setConversationId(result.conversation.id);
        setMessages(result.conversation.messages);
        setImageUrl(result.imageUrl);
        setTitle(result.title);
        setTokenUri(result.tokenUri ?? undefined);

        // Navigate to the conversation page
        navigate(`/conversation/${result.conversation.id}`);
      } else {
        // Short session response
        setGenerationStep("Anky is reading...");
        const result = await api.generateShort(savedSession.id);

        setConversationId(result.conversation.id);
        setMessages([
          {
            id: "initial",
            role: "assistant",
            content: result.response,
            createdAt: new Date().toISOString(),
          },
        ]);

        // Navigate to the conversation page
        navigate(`/conversation/${result.conversation.id}`);
      }
    } catch (error) {
      console.error("Failed to process session:", error);
      setGenerationStep("Something went wrong...");
    } finally {
      setIsGenerating(false);
      setGenerationStep(undefined);
    }
  }, [
    authenticated,
    login,
    navigate,
    session,
  ]);

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!conversationId) return;

      // Optimistically add user message
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const { message: aiMessage } = await api.sendMessage(
          conversationId,
          message
        );
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== userMessage.id),
          { ...userMessage, id: `user-${Date.now()}` },
          aiMessage,
        ]);
      } catch (error) {
        console.error("Failed to send message:", error);
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      }
    },
    [conversationId]
  );

  const handleWriteAgain = useCallback(() => {
    session.reset();
    setView("writing");
    setMessages([]);
    setConversationId(undefined);
    setImageUrl(undefined);
    setTitle(undefined);
    setTokenUri(undefined);
  }, [session]);

  // Handle session end when inactivity timer fires
  if (session.isWriting && session.timeRemaining <= 0) {
    handleSessionEnd();
  }

  if (view === "chat") {
    return (
      <ChatInterface
        messages={messages}
        writingContent={session.content}
        imageUrl={imageUrl}
        title={title}
        isComplete={session.isComplete}
        isGenerating={isGenerating}
        generationStep={generationStep}
        tokenUri={tokenUri}
        conversationId={conversationId}
        onSendMessage={handleSendMessage}
        onWriteAgain={handleWriteAgain}
      />
    );
  }

  return (
    <WritingArea
      content={session.content}
      isWriting={session.isWriting}
      stats={session.stats}
      timeRemaining={session.timeRemaining}
      isDanger={session.isDanger}
      isAnkyMode={session.isAnkyMode}
      onInput={session.handleInput}
      onKeyDown={session.handleKeyDown}
    />
  );
}
