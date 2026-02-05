import { Hono } from "hono";
import { isDatabaseAvailable } from "../db/index.js";
import * as dbOps from "../db/operations.js";
import { apiKeyMiddleware, getAgentId, getAgentName, generateApiKey, hashApiKey } from "../middleware/apiKey.js";
import { Logger } from "../lib/logger.js";

const logger = Logger("API-v1");

const app = new Hono();

// Request logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  logger.info(`>>> v1 REQUEST: ${method} ${path}`);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info(`<<< v1 RESPONSE: ${method} ${path} ${status} ${duration}ms`);
});

// ============================================================================
// AGENT REGISTRATION (Public)
// ============================================================================

app.post("/agents/register", async (c) => {
  logger.info("Registering new agent");

  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const body = await c.req.json();
  const { name, description, model } = body;

  if (!name) {
    return c.json({ error: "name is required" }, 400);
  }

  // Check if name is already taken
  const existing = await dbOps.getAgentByName(name);
  if (existing) {
    return c.json({ error: "Agent name already taken" }, 409);
  }

  // Generate API key
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);

  // Create agent
  const agent = await dbOps.createAgent({
    name,
    description,
    model,
    apiKeyHash,
  });

  if (!agent) {
    return c.json({ error: "Failed to create agent" }, 500);
  }

  logger.info(`Agent registered: ${agent.name} (${agent.id})`);

  // Return agent info with the plaintext API key (only shown once)
  return c.json({
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      createdAt: agent.createdAt,
    },
    apiKey, // Only returned once!
  });
});

// ============================================================================
// AGENT PROFILE (Authenticated)
// ============================================================================

app.get("/agents/me", apiKeyMiddleware, async (c) => {
  const agentId = getAgentId(c);

  if (!agentId) {
    return c.json({ error: "Agent not found in context" }, 500);
  }

  const agent = await dbOps.getAgentById(agentId);

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json({
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      model: agent.model,
      sessionCount: agent.sessionCount,
      lastActiveAt: agent.lastActiveAt,
      createdAt: agent.createdAt,
    },
  });
});

// ============================================================================
// SESSION SUBMISSION (Authenticated)
// ============================================================================

app.post("/sessions", apiKeyMiddleware, async (c) => {
  logger.info("Agent submitting session");

  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const agentId = getAgentId(c);
  const agentName = getAgentName(c);

  if (!agentId) {
    return c.json({ error: "Agent not found in context" }, 500);
  }

  const body = await c.req.json();
  const { content, durationSeconds, wordCount, wordsPerMinute } = body;

  if (!content || durationSeconds === undefined || wordCount === undefined) {
    return c.json({ error: "content, durationSeconds, wordCount required" }, 400);
  }

  // Create session
  const session = await dbOps.createWritingSessionForAgent({
    agentId,
    content,
    durationSeconds,
    wordCount,
    wordsPerMinute,
    isPublic: true, // Agent sessions are public by default
  });

  if (!session) {
    return c.json({ error: "Failed to create session" }, 500);
  }

  const isAnky = durationSeconds >= 480;
  logger.info(`Agent ${agentName} created session: ${session.id} (${wordCount} words, ${Math.floor(durationSeconds / 60)}min, isAnky=${isAnky})`);

  // If this is a full Anky session, generate the Anky
  let anky = null;
  if (isAnky) {
    try {
      // Generate prompt, reflection, image, and title
      const [promptResult, reflectionResult] = await Promise.all([
        generatePrompt(content),
        generateReflection(content),
      ]);

      const imageResult = await generateImage(promptResult.prompt);

      const titleResult = await generateTitle(
        content,
        promptResult.prompt,
        reflectionResult.reflection
      );

      // Create Anky record
      anky = await dbOps.createAnky({
        writingSessionId: session.id,
        imagePrompt: promptResult.prompt,
        reflection: reflectionResult.reflection,
        title: titleResult.title,
        imageBase64: imageResult.base64,
        imageUrl: imageResult.url,
      });

      logger.info(`Anky generated for agent ${agentName}: ${anky?.title}`);
    } catch (e) {
      logger.error("Failed to generate Anky for agent session:", e);
      // Continue without anky - session is still created
    }
  }

  return c.json({
    session: {
      id: session.id,
      shareId: session.shareId,
      isAnky: session.isAnky,
      wordCount: session.wordCount,
      durationSeconds: session.durationSeconds,
      createdAt: session.createdAt,
    },
    anky: anky ? {
      id: anky.id,
      title: anky.title,
      imageUrl: anky.imageUrl,
      reflection: anky.reflection,
    } : null,
  });
});

// ============================================================================
// GET AGENT'S SESSIONS (Authenticated)
// ============================================================================

app.get("/sessions/me", apiKeyMiddleware, async (c) => {
  const agentId = getAgentId(c);

  if (!agentId) {
    return c.json({ error: "Agent not found in context" }, 500);
  }

  const limit = parseInt(c.req.query("limit") || "50");
  const sessions = await dbOps.getAgentSessions(agentId, limit);

  return c.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      shareId: s.shareId,
      content: s.content,
      isAnky: s.isAnky,
      wordCount: s.wordCount,
      durationSeconds: s.durationSeconds,
      createdAt: s.createdAt,
      anky: s.anky ? {
        id: s.anky.id,
        title: s.anky.title,
        imageUrl: s.anky.imageUrl,
        reflection: s.anky.reflection,
      } : null,
    })),
  });
});

// ============================================================================
// HELPER FUNCTIONS FOR AI GENERATION
// ============================================================================

async function generatePrompt(writingSession: string): Promise<{ prompt: string }> {
  const systemPrompt = `CONTEXT: You are generating an image prompt for Anky based on a user's 8-minute stream of consciousness writing session. Anky is a blue-skinned creature with purple swirling hair, golden/amber eyes, golden decorative accents and jewelry, large expressive ears, and an ancient-yet-childlike quality. Anky exists in mystical, richly colored environments (deep blues, purples, oranges, golds). The aesthetic is spiritual but not sterile — warm, alive, slightly psychedelic.

YOUR TASK: Read the user's writing and create a scene where Anky embodies the EMOTIONAL TRUTH of what they wrote — not a literal illustration, but a symbolic mirror. Anky should be DOING something or BE somewhere that reflects the user's inner state.

ALWAYS INCLUDE:
- Rich color palette (blues, purples, golds, oranges)
- Atmospheric lighting (firelight, cosmic light, dawn/dusk)
- One symbolic detail that captures the SESSION'S CORE TENSION
- Anky's expression should match the emotional undercurrent (not the surface content)

OUTPUT: A single detailed image generation prompt, 2-3 sentences, painterly/fantasy style. Nothing else.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: writingSession }],
    }),
  });

  const data = await response.json() as { content?: Array<{ text: string }> };

  if (!response.ok || !data.content?.[0]) {
    throw new Error("Failed to generate prompt");
  }

  return { prompt: data.content[0].text };
}

async function generateReflection(writingSession: string): Promise<{ reflection: string }> {
  const systemPrompt = `Take a look at my journal entry below. I'd like you to analyze it and respond with deep insight that feels personal, not clinical. Imagine you're not just a friend, but a mentor who truly gets both my tech background and my psychological patterns. I want you to uncover the deeper meaning and emotional undercurrents behind my scattered thoughts. Keep it casual, dont say yo, help me make new connections i don't see, comfort, validate, challenge, all of it. dont be afraid to say a lot. format with markdown headings if needed. Use vivid metaphors and powerful imagery to help me see what I'm really building. Organize your thoughts with meaningful headings that create a narrative journey through my ideas. Don't just validate my thoughts - reframe them in a way that shows me what I'm really seeking beneath the surface. Go beyond the product concepts to the emotional core of what I'm trying to solve. Be willing to be profound and philosophical without sounding like you're giving therapy. I want someone who can see the patterns I can't see myself and articulate them in a way that feels like an epiphany. Start with 'hey, thanks for showing me this. my thoughts:' and then use markdown headings to structure your response. Here's my journal entry:

`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: writingSession }],
    }),
  });

  const data = await response.json() as { content?: Array<{ text: string }> };

  if (!response.ok || !data.content?.[0]) {
    throw new Error("Failed to generate reflection");
  }

  return { reflection: data.content[0].text };
}

async function generateImage(prompt: string): Promise<{ url: string; base64?: string }> {
  // Import the image generation function
  const { generateImageWithReferences } = await import("./lib/imageGen.js");
  return generateImageWithReferences(prompt);
}

async function generateTitle(
  writingSession: string,
  imagePrompt: string,
  reflection: string
): Promise<{ title: string }> {
  const systemPrompt = `CONTEXT: You are naming an Anky — a visual representation of a user's 8-minute stream of consciousness writing session. The title is not a summary. It is a MIRROR. It should capture the emotional truth, the core tension, or the unconscious thread running through the writing.

YOUR TASK: Generate a title of MAXIMUM 3 WORDS that:
- Captures the ESSENCE, not the content
- Could be poetic, stark, ironic, or tender
- Should resonate with the user when they see it
- Works as a title for the generated image
- Does NOT explain — it EVOKES

STYLE:
- Lowercase preferred (unless emphasis needed)
- No punctuation unless essential
- Can be a fragment, question, or imperative
- Can be abstract or concrete

OUTPUT: Exactly ONE title (max 3 words). Nothing else. No quotes.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `WRITING SESSION:\n${writingSession}\n\nIMAGE PROMPT:\n${imagePrompt}\n\nREFLECTION:\n${reflection}`,
        },
      ],
    }),
  });

  const data = await response.json() as { content?: Array<{ text: string }> };

  if (!response.ok || !data.content?.[0]) {
    throw new Error("Failed to generate title");
  }

  const rawTitle = data.content[0].text.trim().toLowerCase().replace(/['"]/g, "");
  return { title: rawTitle };
}

export default app;
