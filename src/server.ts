import { serve } from "bun";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import apiRoutes from "./api/index.js";

const app = new Hono();

// CORS configuration
app.use(
  "/api/*",
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:4173",
      "https://miniapp.anky.app",
      "https://anky.app",
      "https://www.anky.app",
      "https://anky-v8.orbiter.website",
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

const port = Number(process.env.PORT) || 3000;

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running at http://localhost:${port}`);
