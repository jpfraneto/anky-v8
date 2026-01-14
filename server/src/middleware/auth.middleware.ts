import { Context, Next } from "hono";
import { verifyPrivyToken, getOrCreateUser } from "../services/auth.service.js";

export interface AuthContext {
  userId: string;
  privyId: string;
  walletAddress: string | null;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyPrivyToken(token);
    const user = await getOrCreateUser(payload);

    c.set("auth", {
      userId: user.id,
      privyId: user.privyId,
      walletAddress: user.walletAddress,
    });

    await next();
  } catch (error) {
    console.error("Auth error:", error);
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyPrivyToken(token);
      const user = await getOrCreateUser(payload);
      c.set("auth", {
        userId: user.id,
        privyId: user.privyId,
        walletAddress: user.walletAddress,
      });
    } catch {
      // Ignore auth errors for optional auth
    }
  }

  await next();
}
