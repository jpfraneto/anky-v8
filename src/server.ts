import { serve } from "bun";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import apiRoutes from "./api/index.js";
import { getConfig, printStartupBanner } from "./config";
import { Logger } from "./lib/logger";

const logger = Logger("Server");
const config = getConfig();

const app = new Hono();

// Top-level request logging (before any other middleware)
app.use("*", async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;
  const url = c.req.url;
  const origin = c.req.header("origin") || "no-origin";

  logger.info(`[SERVER] Incoming: ${method} ${path}`);
  logger.info(`[SERVER] Full URL: ${url}`);
  logger.info(`[SERVER] Origin: ${origin}`);

  // Log preflight requests specifically
  if (method === "OPTIONS") {
    logger.info(`[SERVER] PREFLIGHT REQUEST for ${path}`);
    logger.info(`[SERVER] Access-Control-Request-Method: ${c.req.header("access-control-request-method")}`);
    logger.info(`[SERVER] Access-Control-Request-Headers: ${c.req.header("access-control-request-headers")}`);
  }

  await next();

  const status = c.res.status;
  const contentType = c.res.headers.get("content-type") || "unknown";
  const corsOrigin = c.res.headers.get("access-control-allow-origin") || "not-set";
  const corsMethods = c.res.headers.get("access-control-allow-methods") || "not-set";

  logger.info(`[SERVER] Response: ${method} ${path} → ${status} (${contentType})`);
  logger.info(`[SERVER] CORS Headers: Allow-Origin=${corsOrigin}, Allow-Methods=${corsMethods}`);
});

// CORS configuration for API routes
app.use(
  "/api/*",
  cors({
    origin: [
      ...config.cors.origins,
      process.env.FRONTEND_URL || "",
    ].filter(Boolean),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Mount API routes FIRST (before static files)
app.route("/api", apiRoutes);

logger.info("API routes mounted at /api");

// Serve static files from public directory (only for non-API routes)
app.use("/*", serveStatic({ root: "./public" }));

// Fallback to index.html for SPA routing (only for non-API routes)
app.get("*", serveStatic({ path: "./public/index.html" }));

const port = config.runtime.port;

// Print startup banner
printStartupBanner();

serve({
  fetch: app.fetch,
  port,
});

logger.info(`Server started successfully on port ${port}`);
