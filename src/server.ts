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

// CORS configuration
app.use(
  "/api/*",
  cors({
    origin: [
      ...config.cors.origins,
      process.env.FRONTEND_URL || "",
    ].filter(Boolean),
    credentials: true,
  }),
);

// Serve static files from public directory
app.use("/*", serveStatic({ root: "./public" }));

// Mount API routes
app.route("/api", apiRoutes);

// Fallback to index.html for SPA routing
app.get("*", serveStatic({ path: "./public/index.html" }));

const port = config.runtime.port;

// Print startup banner
printStartupBanner();

serve({
  fetch: app.fetch,
  port,
});

logger.info(`Server started successfully on port ${port}`);
