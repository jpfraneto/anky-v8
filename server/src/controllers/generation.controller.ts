import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.middleware.js";
import * as claudeService from "../services/claude.service.js";
import * as geminiService from "../services/gemini.service.js";
import * as ipfsService from "../services/ipfs.service.js";
import * as conversationService from "../services/conversation.service.js";
import * as sessionService from "../services/session.service.js";

const generationController = new Hono();

// Generate full Anky (image prompt, reflection, image, title, IPFS)
generationController.post("/full", authMiddleware, async (c) => {
  const { userId, walletAddress } = c.get("auth");
  const { writingSessionId, locale = "en" } = await c.req.json();

  if (!writingSessionId) {
    return c.json({ error: "Writing session ID required" }, 400);
  }

  try {
    const session = await sessionService.getSessionById(writingSessionId);

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    if (session.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    if (!session.isComplete) {
      return c.json({ error: "Session must be at least 8 minutes to generate an Anky" }, 400);
    }

    const writingContent = session.content;

    // Step 1: Generate image prompt and reflection in parallel
    const [imagePrompt, reflection] = await Promise.all([
      claudeService.generateImagePrompt(writingContent),
      claudeService.generateReflection(writingContent, locale),
    ]);

    // Step 2: Generate image and title in parallel
    const [imageResult, title] = await Promise.all([
      geminiService.generateImage(imagePrompt),
      claudeService.generateTitle(writingContent, imagePrompt, reflection),
    ]);

    // Step 3: Upload to IPFS if configured
    let writingIpfs: string | null = null;
    let imageIpfs: string | null = null;
    let tokenUri: string | null = null;

    if (ipfsService.isIpfsConfigured()) {
      const uploadResult = await ipfsService.uploadToIpfs(
        writingContent,
        imageResult.base64,
        title,
        reflection,
        imagePrompt,
        walletAddress ?? undefined
      );
      writingIpfs = uploadResult.writingSessionIpfs;
      imageIpfs = uploadResult.imageIpfs;
      tokenUri = uploadResult.tokenUri;
    }

    // Create or update conversation
    let conversation = session.conversation;
    if (!conversation) {
      conversation = await conversationService.createConversation({
        userId,
        writingSessionId,
        title,
        reflection,
        imagePrompt,
        imageUrl: imageResult.url,
        imageIpfs,
        writingIpfs,
        tokenUri,
      });
    } else {
      conversation = await conversationService.updateConversation(conversation.id, {
        title,
        reflection,
        imagePrompt,
        imageUrl: imageResult.url,
        imageIpfs,
        writingIpfs,
        tokenUri,
      });
    }

    // Add reflection as first assistant message if not exists
    const messages = await conversationService.getMessages(conversation.id);
    if (messages.length === 0) {
      await conversationService.addMessage(conversation.id, "assistant", reflection);
    }

    return c.json({
      conversation,
      imagePrompt,
      reflection,
      title,
      imageUrl: imageResult.url,
      imageBase64: imageResult.base64,
      writingIpfs,
      imageIpfs,
      tokenUri,
    });
  } catch (error) {
    console.error("Full generation error:", error);
    return c.json({ error: "Generation failed" }, 500);
  }
});

// Generate initial response for short session
generationController.post("/short", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const { writingSessionId } = await c.req.json();

  if (!writingSessionId) {
    return c.json({ error: "Writing session ID required" }, 400);
  }

  try {
    const session = await sessionService.getSessionById(writingSessionId);

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    if (session.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // Generate initial response
    const response = await claudeService.chatWithAnkyShort(
      session.content,
      session.duration,
      session.wordCount,
      []
    );

    // Create conversation if doesn't exist
    let conversation = session.conversation;
    if (!conversation) {
      conversation = await conversationService.createConversation({
        userId,
        writingSessionId,
      });
    }

    // Add as first assistant message
    await conversationService.addMessage(conversation.id, "assistant", response);

    return c.json({
      conversation,
      response,
    });
  } catch (error) {
    console.error("Short generation error:", error);
    return c.json({ error: "Generation failed" }, 500);
  }
});

// Individual generation endpoints for testing/streaming
generationController.post("/prompt", authMiddleware, async (c) => {
  const { writingSession } = await c.req.json();

  if (!writingSession) {
    return c.json({ error: "Writing session required" }, 400);
  }

  try {
    const prompt = await claudeService.generateImagePrompt(writingSession);
    return c.json({ prompt });
  } catch (error) {
    console.error("Prompt generation error:", error);
    return c.json({ error: "Failed to generate prompt" }, 500);
  }
});

generationController.post("/reflection", authMiddleware, async (c) => {
  const { writingSession, locale = "en" } = await c.req.json();

  if (!writingSession) {
    return c.json({ error: "Writing session required" }, 400);
  }

  try {
    const reflection = await claudeService.generateReflection(writingSession, locale);
    return c.json({ reflection });
  } catch (error) {
    console.error("Reflection generation error:", error);
    return c.json({ error: "Failed to generate reflection" }, 500);
  }
});

generationController.post("/image", authMiddleware, async (c) => {
  const { prompt } = await c.req.json();

  if (!prompt) {
    return c.json({ error: "Prompt required" }, 400);
  }

  try {
    const result = await geminiService.generateImage(prompt);
    return c.json(result);
  } catch (error) {
    console.error("Image generation error:", error);
    return c.json({ error: "Failed to generate image" }, 500);
  }
});

generationController.post("/title", authMiddleware, async (c) => {
  const { writingSession, imagePrompt, reflection } = await c.req.json();

  if (!writingSession || !imagePrompt || !reflection) {
    return c.json({ error: "Writing session, image prompt, and reflection required" }, 400);
  }

  try {
    const title = await claudeService.generateTitle(writingSession, imagePrompt, reflection);
    return c.json({ title });
  } catch (error) {
    console.error("Title generation error:", error);
    return c.json({ error: "Failed to generate title" }, 500);
  }
});

generationController.post("/ipfs", authMiddleware, async (c) => {
  const { walletAddress } = c.get("auth");
  const { writingSession, imageBase64, title, reflection, imagePrompt } = await c.req.json();

  if (!writingSession || !imageBase64 || !title || !reflection || !imagePrompt) {
    return c.json({ error: "All fields required" }, 400);
  }

  if (!ipfsService.isIpfsConfigured()) {
    return c.json({ error: "IPFS not configured" }, 400);
  }

  try {
    const result = await ipfsService.uploadToIpfs(
      writingSession,
      imageBase64,
      title,
      reflection,
      imagePrompt,
      walletAddress ?? undefined
    );
    return c.json(result);
  } catch (error) {
    console.error("IPFS upload error:", error);
    return c.json({ error: "Failed to upload to IPFS" }, 500);
  }
});

export default generationController;
