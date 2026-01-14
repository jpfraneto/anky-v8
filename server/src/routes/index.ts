import { Hono } from "hono";
import authController from "../controllers/auth.controller.js";
import sessionController from "../controllers/session.controller.js";
import conversationController from "../controllers/conversation.controller.js";
import generationController from "../controllers/generation.controller.js";

const api = new Hono();

// Mount all controllers
api.route("/auth", authController);
api.route("/sessions", sessionController);
api.route("/conversations", conversationController);
api.route("/generate", generationController);

// Health check
api.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default api;
