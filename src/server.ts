import { serve } from "bun";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import apiRoutes from "./api/index.js";

const app = new Hono();

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
