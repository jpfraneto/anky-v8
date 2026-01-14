import { Hono } from "hono";
import { verifyPrivyToken, getOrCreateUser, updateUserSettings } from "../services/auth.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { prisma } from "../models/index.js";

const authController = new Hono();

// Verify token and get/create user
authController.post("/verify", async (c) => {
  const { token } = await c.req.json();

  if (!token) {
    return c.json({ error: "Token required" }, 400);
  }

  try {
    const payload = await verifyPrivyToken(token);
    const user = await getOrCreateUser(payload);

    return c.json({
      user: {
        id: user.id,
        privyId: user.privyId,
        walletAddress: user.walletAddress,
        settings: user.settings,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Verify error:", error);
    return c.json({ error: "Invalid token" }, 401);
  }
});

// Get current user
authController.get("/me", authMiddleware, async (c) => {
  const { userId } = c.get("auth");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: {
      id: user.id,
      privyId: user.privyId,
      walletAddress: user.walletAddress,
      settings: user.settings,
      createdAt: user.createdAt,
    },
  });
});

// Update user settings
authController.patch("/settings", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json();

  const { fontFamily, fontSize, primaryColor, bgColor } = body;

  try {
    const settings = await updateUserSettings(userId, {
      fontFamily,
      fontSize,
      primaryColor,
      bgColor,
    });

    return c.json({ settings });
  } catch (error) {
    console.error("Update settings error:", error);
    return c.json({ error: "Failed to update settings" }, 500);
  }
});

export default authController;
