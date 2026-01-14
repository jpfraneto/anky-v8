import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import api from "./routes/index.js";
import { initAnkyReferences } from "./services/gemini.service.js";

// Initialize Anky reference images on startup
initAnkyReferences();

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://anky.bot",
      "https://anky.app",
      "https://www.anky.app",
      "https://anky-v8.orbiter.website",
    ],
    credentials: true,
  })
);

// API routes
app.route("/api", api);

// Serve static files from public directory (for reference images)
app.use("/public/*", serveStatic({ root: "./" }));

// For production: serve the React app
app.get("*", serveStatic({ root: "../client/dist" }));

// Fallback for SPA routing
app.get("*", async (c) => {
  try {
    const file = Bun.file("../client/dist/index.html");
    const content = await file.text();
    return c.html(content);
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

const port = parseInt(process.env.PORT ?? "3000");

console.log(`Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
