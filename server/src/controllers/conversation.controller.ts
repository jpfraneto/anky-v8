import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.middleware.js";
import * as conversationService from "../services/conversation.service.js";
import * as sessionService from "../services/session.service.js";
import * as claudeService from "../services/claude.service.js";

const conversationController = new Hono();

// Create a new conversation from a writing session
conversationController.post("/", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json();

  const { writingSessionId, title, reflection, imagePrompt, imageUrl, imageIpfs, writingIpfs, tokenUri } = body;

  if (!writingSessionId) {
    return c.json({ error: "Writing session ID required" }, 400);
  }

  // Verify the session belongs to the user
  const session = await sessionService.getSessionById(writingSessionId);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  if (session.userId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  try {
    const conversation = await conversationService.createConversation({
      userId,
      writingSessionId,
      title,
      reflection,
      imagePrompt,
      imageUrl,
      imageIpfs,
      writingIpfs,
      tokenUri,
    });

    return c.json({ conversation });
  } catch (error) {
    console.error("Create conversation error:", error);
    return c.json({ error: "Failed to create conversation" }, 500);
  }
});

// Get all conversations for current user
conversationController.get("/", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const limit = parseInt(c.req.query("limit") ?? "50");

  try {
    const conversations = await conversationService.getConversationsByUser(userId, limit);
    return c.json({ conversations });
  } catch (error) {
    console.error("Get conversations error:", error);
    return c.json({ error: "Failed to get conversations" }, 500);
  }
});

// Get a specific conversation
conversationController.get("/:id", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const conversationId = c.req.param("id");

  try {
    const conversation = await conversationService.getConversationById(conversationId);

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    if (conversation.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    return c.json({ conversation });
  } catch (error) {
    console.error("Get conversation error:", error);
    return c.json({ error: "Failed to get conversation" }, 500);
  }
});

// Delete a conversation
conversationController.delete("/:id", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const conversationId = c.req.param("id");

  try {
    const conversation = await conversationService.getConversationById(conversationId);

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    if (conversation.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    await conversationService.deleteConversation(conversationId);
    return c.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return c.json({ error: "Failed to delete conversation" }, 500);
  }
});

// Add a message to a conversation
conversationController.post("/:id/messages", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const conversationId = c.req.param("id");
  const { content } = await c.req.json();

  if (!content || content.trim().length === 0) {
    return c.json({ error: "Message content required" }, 400);
  }

  try {
    const conversation = await conversationService.getConversationById(conversationId);

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    if (conversation.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // Add user message
    const userMessage = await conversationService.addMessage(conversationId, "user", content);

    return c.json({ message: userMessage });
  } catch (error) {
    console.error("Add message error:", error);
    return c.json({ error: "Failed to add message" }, 500);
  }
});

// Chat with Anky (get AI response)
conversationController.post("/:id/chat", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const conversationId = c.req.param("id");
  const { message } = await c.req.json();

  if (!message || message.trim().length === 0) {
    return c.json({ error: "Message required" }, 400);
  }

  try {
    const conversation = await conversationService.getConversationById(conversationId);

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    if (conversation.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // Add user message
    await conversationService.addMessage(conversationId, "user", message);

    // Get all messages for context
    const messages = await conversationService.getMessages(conversationId);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    // Generate AI response based on session type
    let response: string;
    const writingSession = conversation.writingSession.content;

    if (conversation.writingSession.isComplete) {
      // Long session - use full context
      response = await claudeService.chatWithAnky(
        writingSession,
        conversation.reflection ?? "",
        conversation.title ?? "",
        history
      );
    } else {
      // Short session
      response = await claudeService.chatWithAnkyShort(
        writingSession,
        conversation.writingSession.duration,
        conversation.writingSession.wordCount,
        history
      );
    }

    // Save AI response
    const aiMessage = await conversationService.addMessage(conversationId, "assistant", response);

    return c.json({ message: aiMessage, response });
  } catch (error) {
    console.error("Chat error:", error);
    return c.json({ error: "Failed to get response" }, 500);
  }
});

// Record a mint
conversationController.post("/:id/mint", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const conversationId = c.req.param("id");
  const { tokenId } = await c.req.json();

  if (typeof tokenId !== "number") {
    return c.json({ error: "Token ID required" }, 400);
  }

  try {
    const conversation = await conversationService.getConversationById(conversationId);

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    if (conversation.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const updated = await conversationService.recordMint(conversationId, tokenId);
    return c.json({ conversation: updated });
  } catch (error) {
    console.error("Record mint error:", error);
    return c.json({ error: "Failed to record mint" }, 500);
  }
});

export default conversationController;
