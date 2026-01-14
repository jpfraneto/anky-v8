import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.middleware.js";
import * as sessionService from "../services/session.service.js";

const sessionController = new Hono();

// Create a new writing session
sessionController.post("/", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json();

  const { content, duration, wordCount, wpm, backspaceCount, enterCount, arrowCount } = body;

  if (!content || content.trim().length === 0) {
    return c.json({ error: "Content required" }, 400);
  }

  if (typeof duration !== "number" || duration < 0) {
    return c.json({ error: "Valid duration required" }, 400);
  }

  try {
    const session = await sessionService.createSession({
      userId,
      content,
      duration,
      wordCount: wordCount ?? 0,
      wpm: wpm ?? 0,
      backspaceCount,
      enterCount,
      arrowCount,
    });

    return c.json({ session });
  } catch (error) {
    console.error("Create session error:", error);
    return c.json({ error: "Failed to create session" }, 500);
  }
});

// Get all sessions for current user
sessionController.get("/", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const limit = parseInt(c.req.query("limit") ?? "50");

  try {
    const sessions = await sessionService.getSessionsByUser(userId, limit);
    return c.json({ sessions });
  } catch (error) {
    console.error("Get sessions error:", error);
    return c.json({ error: "Failed to get sessions" }, 500);
  }
});

// Get a specific session
sessionController.get("/:id", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const sessionId = c.req.param("id");

  try {
    const session = await sessionService.getSessionById(sessionId);

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    if (session.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    return c.json({ session });
  } catch (error) {
    console.error("Get session error:", error);
    return c.json({ error: "Failed to get session" }, 500);
  }
});

// Delete a session
sessionController.delete("/:id", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const sessionId = c.req.param("id");

  try {
    const session = await sessionService.getSessionById(sessionId);

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    if (session.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    await sessionService.deleteSession(sessionId);
    return c.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return c.json({ error: "Failed to delete session" }, 500);
  }
});

export default sessionController;
