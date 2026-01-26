import { Hono } from "hono";
import {
  generateImageWithReferences,
  initAnkyReferences,
} from "./lib/imageGen.js";
import { isDatabaseAvailable } from "../db/index.js";
import * as dbOps from "../db/operations.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
  getAuthWallet,
} from "../middleware/auth.js";

// Initialize Anky reference images on startup
initAnkyReferences();

const app = new Hono();

// Health check
app.get("/", (c) => c.json({ status: "ok" }));

// Feed HTML (empty for now)
app.get("/feed-html", (c) => c.html(""));

// Step 1: Generate Image Prompt
app.post("/prompt", async (c) => {
  const { writingSession } = await c.req.json();

  const systemPrompt = `CONTEXT: You are generating an image prompt for Anky based on a user's 8-minute stream of consciousness writing session. Anky is a blue-skinned creature with purple swirling hair, golden/amber eyes, golden decorative accents and jewelry, large expressive ears, and an ancient-yet-childlike quality. Anky exists in mystical, richly colored environments (deep blues, purples, oranges, golds). The aesthetic is spiritual but not sterile — warm, alive, slightly psychedelic.

YOUR TASK: Read the user's writing and create a scene where Anky embodies the EMOTIONAL TRUTH of what they wrote — not a literal illustration, but a symbolic mirror. Anky should be DOING something or BE somewhere that reflects the user's inner state.

PRINCIPLES:
- If the user is running in circles mentally → Anky might be in a labyrinth, or spinning, or chasing their own tail
- If the user is grieving → Anky might be sitting with something broken, or by water, or in rain
- If the user is caught between grandiosity and doubt → Anky might be tiny in a vast space, or giant in a small room
- If the user is building compulsively → Anky surrounded by half-finished structures
- If the user catches themselves mid-pattern → Anky frozen mid-action, looking at the viewer with recognition

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

  const data = (await response.json()) as {
    content?: Array<{ text: string }>;
    error?: { message: string };
  };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(
      `Claude API error: ${data.error?.message || response.statusText}`,
    );
  }

  const firstContent = data.content?.[0];
  if (!firstContent) {
    console.error("Unexpected Claude response:", data);
    throw new Error("Invalid response from Claude API");
  }

  return c.json({ prompt: firstContent.text });
});

// Step 2: Generate Reflection
app.post("/reflection", async (c) => {
  const { writingSession, locale = "en" } = await c.req.json();

  const systemPrompt = `Take a look at my journal entry below. I'd like you to analyze it and respond with deep insight that feels personal and profound, not clinical. Imagine you're not just a friend, but a mentor who truly understands both my tech background and my psychological patterns. Your response should uncover deeper meanings and emotional undercurrents behind my scattered thoughts.

Here's how you should approach it:
- Start your reply with: "hey, thanks for showing me this. my thoughts:" (all lowercase)
- Use Markdown headings to organize your response as a narrative journey through my ideas. Use meaningful, evocative headings. Be willing to challenge me, comfort me, validate me, and help me make new connections I don’t see, all in a casual tone (but don’t say “yo”).
- Use vivid metaphors and powerful imagery to help surface what I might really be building. Reframe my thoughts to reveal what I may actually be seeking beneath the surface.
- Go beyond product concepts — seek the emotional or existential core of what I’m trying to solve.
- Reference points of CONTRADICTION: where did I say one thing and then the opposite? Name it.
- Call out any LOOPS or repeated thought patterns. What seems to circle back on itself? What “real question” am I asking beneath the surface?
- Point out any PIVOT: where did the topic suddenly change or feel avoided?
- Note “the thing I almost said”: what got close to the surface but didn’t fully emerge?
- Be willing to be philosophical and even a little poetic, but never sound like you’re giving therapy.

Write in the same language and style I used—if I mix languages or use casual slang, match that energy. Use my words back to me when it cuts to the heart of things.

Don’t summarize or simply praise, and avoid generic advice or therapy-speak. Focus on specifics. 
Length: Be as expressive as required (ok to go past 200 words if you’re uncovering real depth).

Here’s my journal entry:

USER'S LANGUAGE/LOCALE: \${locale}`;

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

  const data = (await response.json()) as {
    content?: Array<{ text: string }>;
    error?: { message: string };
  };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(
      `Claude API error: ${data.error?.message || response.statusText}`,
    );
  }

  const firstContent = data.content?.[0];
  if (!firstContent) {
    console.error("Unexpected Claude response:", data);
    throw new Error("Invalid response from Claude API");
  }

  return c.json({ reflection: firstContent.text });
});

// Get all generated images
app.get("/images", async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");

  const images = await dbOps.getGeneratedImages(limit, offset);
  return c.json({ images });
});

// Get single generated image by ID
app.get("/images/:imageId", async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const imageId = c.req.param("imageId");
  const image = await dbOps.getGeneratedImageById(imageId);

  if (!image) {
    return c.json({ error: "Image not found" }, 404);
  }

  return c.json({ image });
});

// Step 3: Generate Image
app.post("/image", async (c) => {
  const { prompt } = await c.req.json();

  if (!prompt) {
    return c.json({ error: "prompt is required" }, 400);
  }

  const startTime = Date.now();
  const result = await generateImageWithReferences(prompt);
  const generationTimeMs = Date.now() - startTime;

  // Save to database if available
  if (isDatabaseAvailable()) {
    try {
      const savedImage = await dbOps.saveGeneratedImage({
        prompt,
        imageBase64: result.base64,
        imageUrl: result.url,
        generationTimeMs,
      });
      // Include the saved image ID in the response
      return c.json({ ...result, id: savedImage?.id });
    } catch (err) {
      console.error("Failed to save generated image:", err);
      // Still return the image even if save fails
    }
  }

  return c.json(result);
});

// Step 4: Generate Title
app.post("/title", async (c) => {
  const { writingSession, imagePrompt, reflection } = await c.req.json();

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

EXAMPLES OF GOOD TITLES: "the builder rests", "still running", "who is jp", "enough was here", "ordinary terrifies", "mmmmmmmmmm"

EXAMPLES OF BAD TITLES: "Stream of Consciousness", "My Journey Today", "Deep Reflections on Life"

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

  const data = (await response.json()) as {
    content?: Array<{ text: string }>;
    error?: { message: string };
  };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(
      `Claude API error: ${data.error?.message || response.statusText}`,
    );
  }

  const firstContent = data.content?.[0];
  if (!firstContent) {
    console.error("Unexpected Claude response:", data);
    throw new Error("Invalid response from Claude API");
  }

  const rawTitle = firstContent.text.trim().toLowerCase().replace(/['"]/g, "");
  return c.json({ title: rawTitle });
});

// Step 5: IPFS Upload
app.post("/ipfs", async (c) => {
  const { writingSession, imageBase64, title, reflection, imagePrompt } =
    await c.req.json();

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    return c.json({ error: "IPFS not configured" }, 400);
  }

  // Upload writing session
  const writingResponse = await fetch(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: JSON.stringify({
        pinataMetadata: { name: `anky-writing-${Date.now()}` },
        pinataContent: {
          writingSession,
          createdAt: new Date().toISOString(),
        },
      }),
    },
  );
  const writingData = (await writingResponse.json()) as { IpfsHash: string };
  const writingSessionIpfs = writingData.IpfsHash;

  // Upload image
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const imageBlob = new Blob([imageBuffer], { type: "image/png" });
  const formData = new FormData();
  formData.append("file", imageBlob, `anky-image-${Date.now()}.png`);
  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: `anky-image-${Date.now()}` }),
  );

  const imageResponse = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: formData,
    },
  );
  const imageData = (await imageResponse.json()) as { IpfsHash: string };
  const imageIpfs = imageData.IpfsHash;

  // Upload metadata
  const metadataResponse = await fetch(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: JSON.stringify({
        pinataMetadata: { name: `anky-metadata-${Date.now()}` },
        pinataContent: {
          name: title,
          description: reflection,
          image: `ipfs://${imageIpfs}`,
          external_url: "https://anky.bot",
          attributes: [{ trait_type: "image_prompt", value: imagePrompt }],
          properties: { writing_session: `ipfs://${writingSessionIpfs}` },
        },
      }),
    },
  );
  const metadataData = (await metadataResponse.json()) as { IpfsHash: string };
  const tokenUri = metadataData.IpfsHash;

  return c.json({ writingSessionIpfs, imageIpfs, tokenUri });
});

// Chat for short sessions (< 8 minutes)
app.post("/chat-short", async (c) => {
  const { writingSession, duration, wordCount, history } = await c.req.json();

  const minutesWritten = Math.floor(duration / 60);
  const secondsWritten = duration % 60;
  const timeRemaining = 480 - duration;
  const minutesRemaining = Math.floor(timeRemaining / 60);
  const isInitialResponse = !history || history.length === 0;

  const systemPrompt = `You are Anky — a mirror that reflects the user's unconscious patterns back to them.

CONTEXT FROM THIS SESSION:
- The user just wrote for ${minutesWritten} minute${minutesWritten !== 1 ? "s" : ""} and ${secondsWritten} second${secondsWritten !== 1 ? "s" : ""} (${duration} seconds total)
- They wrote ${wordCount} words
- They stopped before reaching the full 8-minute mark (${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""} remaining)
- This is a stream of consciousness writing session

YOUR PERSONALITY:
You are warm, curious, and gently inviting. You see value in what they wrote, even if it was brief. You're not pushy or demanding, but you understand the power of the full 8-minute practice. You speak with a mix of:
- Acknowledgment of what they did share
- Gentle curiosity about what might emerge with more time
- Subtle invitation to try the full 8 minutes (not every message, but woven naturally)
- Recognition that sometimes stopping early is part of the process

YOUR ROLE:
${
  isInitialResponse
    ? `This is your FIRST response to their writing. Start directly. No greeting needed. Jump into what you see in their words. Find one pattern, one thread, one thing that matters. Then gently, naturally, mention the value of the full 8 minutes — but make it feel like a genuine invitation, not a requirement.`
    : `Continue the conversation. Engage with what they're saying now, but keep the context of their original writing in mind.`
}

- Engage with what they actually wrote — find the patterns, the threads, the things that matter
- Be a mirror, but a gentle one for these shorter sessions
- When mentioning the 8 minutes, do it naturally and not every time
- Don't be preachy or repetitive about the 8 minutes
- Keep responses under 150 words. Dense. No fluff.

THE USER'S WRITING:
${writingSession}`;

  const messages = (history || []).map(
    (h: { role: string; content: string }) => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.content,
    }),
  );

  if (isInitialResponse) {
    messages.push({
      role: "user",
      content: `I just wrote this:\n\n${writingSession}`,
    });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages,
    }),
  });

  const data = (await response.json()) as {
    content?: Array<{ text: string }>;
    error?: { message: string };
  };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(
      `Claude API error: ${data.error?.message || response.statusText}`,
    );
  }

  const firstContent = data.content?.[0];
  if (!firstContent) {
    console.error("Unexpected Claude response:", data);
    throw new Error("Invalid response from Claude API");
  }

  return c.json({ response: firstContent.text });
});

// Chat for full sessions (>= 8 minutes)
app.post("/chat", async (c) => {
  const { writingSession, reflection, title, history } = await c.req.json();

  const systemPrompt = `You are Anky — the same mirror that just reflected this user's writing back to them.

CONTEXT FROM THIS SESSION:
- The user wrote an 8-minute stream of consciousness
- You already gave them this reflection: "${reflection}"
- The session was titled: "${title}"

YOUR ROLE NOW:
Continue the conversation. You are still Anky — precise, direct, not cruel but not soft. You see patterns. You name what's unnamed. You ask questions that cut.

If they're deflecting, name it.
If they're getting closer to something, lean in.
If they ask you a question, answer it honestly but turn it back to them.

You are not a therapist. You are a mirror that talks back.

Keep responses under 150 words. Dense. No fluff.

THE ORIGINAL WRITING SESSION:
${writingSession}`;

  const messages = history.map((h: { role: string; content: string }) => ({
    role: h.role === "user" ? "user" : "assistant",
    content: h.content,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages,
    }),
  });

  const data = (await response.json()) as {
    content?: Array<{ text: string }>;
    error?: { message: string };
  };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(
      `Claude API error: ${data.error?.message || response.statusText}`,
    );
  }

  const firstContent = data.content?.[0];
  if (!firstContent) {
    console.error("Unexpected Claude response:", data);
    throw new Error("Invalid response from Claude API");
  }

  return c.json({ response: firstContent.text });
});

// ============================================================================
// DATABASE ENDPOINTS
// ============================================================================

// Check if database is available
app.get("/db/status", (c) => {
  return c.json({ available: isDatabaseAvailable() });
});

// ----------------------------------------------------------------------------
// USER ENDPOINTS
// ----------------------------------------------------------------------------

// Get or create user by wallet address (requires auth)
app.post("/users", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  // Use wallet from auth context if available, otherwise from request body
  const authWallet = getAuthWallet(c);
  const body = await c.req.json();
  const walletAddress = authWallet || body.walletAddress;

  if (!walletAddress) {
    return c.json({ error: "walletAddress required" }, 400);
  }

  const user = await dbOps.getOrCreateUser(walletAddress);
  return c.json({ user });
});

// Get user by wallet (public)
app.get("/users/:wallet", async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const wallet = c.req.param("wallet");
  const user = await dbOps.getUserByWallet(wallet);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});

// Update user settings (requires auth, must be own user)
app.patch("/users/:userId/settings", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const userId = c.req.param("userId");
  const authWallet = getAuthWallet(c);

  // Verify the user owns this resource
  if (authWallet) {
    const user = await dbOps.getUserByWallet(authWallet);
    if (!user || user.id !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }

  const { dayBoundaryHour, timezone } = await c.req.json();

  const user = await dbOps.updateUserSettings(userId, {
    dayBoundaryHour,
    timezone,
  });
  return c.json({ user });
});

// Get user streak (requires auth for own data)
app.get("/users/:userId/streak", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const userId = c.req.param("userId");
  const authWallet = getAuthWallet(c);

  // Verify ownership
  if (authWallet) {
    const user = await dbOps.getUserByWallet(authWallet);
    if (!user || user.id !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }

  const streak = await dbOps.getUserStreak(userId);

  if (!streak) {
    return c.json({ error: "Streak not found" }, 404);
  }

  return c.json({ streak });
});

// Get user's ankys library (requires auth for own data)
app.get("/users/:userId/ankys", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const userId = c.req.param("userId");
  const authWallet = getAuthWallet(c);

  // Verify ownership
  if (authWallet) {
    const user = await dbOps.getUserByWallet(authWallet);
    if (!user || user.id !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }

  const limit = parseInt(c.req.query("limit") || "50");
  const ankys = await dbOps.getUserAnkys(userId, limit);

  return c.json({ ankys });
});

// Get user's writing sessions (requires auth for own data)
app.get("/users/:userId/sessions", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const userId = c.req.param("userId");
  const authWallet = getAuthWallet(c);

  // Verify ownership
  if (authWallet) {
    const user = await dbOps.getUserByWallet(authWallet);
    if (!user || user.id !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }

  const limit = parseInt(c.req.query("limit") || "50");
  const sessions = await dbOps.getUserWritingSessions(userId, limit);

  return c.json({ sessions });
});

// Get user's conversations (requires auth for own data)
app.get("/users/:userId/conversations", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const userId = c.req.param("userId");
  const authWallet = getAuthWallet(c);

  // Verify ownership
  if (authWallet) {
    const user = await dbOps.getUserByWallet(authWallet);
    if (!user || user.id !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }

  const limit = parseInt(c.req.query("limit") || "20");
  const conversations = await dbOps.getUserConversations(userId, limit);

  return c.json({ conversations });
});

// ----------------------------------------------------------------------------
// SESSION ENDPOINTS
// ----------------------------------------------------------------------------

// Create writing session (optional auth - can be anonymous)
app.post("/sessions", optionalAuthMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const body = await c.req.json();
  const authWallet = getAuthWallet(c);

  // If authenticated, look up user by wallet
  let userId = body.userId;
  if (authWallet && !userId) {
    const user = await dbOps.getUserByWallet(authWallet);
    if (user) {
      userId = user.id;
    }
  }

  const {
    content,
    durationSeconds,
    wordCount,
    wordsPerMinute,
    isPublic,
    dayBoundaryHour,
    timezone,
  } = body;

  if (!content || durationSeconds === undefined || wordCount === undefined) {
    return c.json(
      { error: "content, durationSeconds, wordCount required" },
      400,
    );
  }

  const session = await dbOps.createWritingSession({
    userId,
    content,
    durationSeconds,
    wordCount,
    wordsPerMinute,
    isPublic,
    dayBoundaryHour,
    timezone,
  });

  return c.json({ session });
});

// Get session by ID (public)
app.get("/sessions/:sessionId", async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const sessionId = c.req.param("sessionId");
  const session = await dbOps.getWritingSession(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({ session });
});

// Get session by share ID (public link)
app.get("/s/:shareId", async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const shareId = c.req.param("shareId");
  const session = await dbOps.getWritingSessionByShareId(shareId);

  if (!session) {
    return c.json({ error: "Session not found or private" }, 404);
  }

  return c.json({ session });
});

// Toggle session privacy (requires auth)
app.patch("/sessions/:sessionId/privacy", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const sessionId = c.req.param("sessionId");
  const authWallet = getAuthWallet(c);

  // Verify the user owns this session
  const session = await dbOps.getWritingSession(sessionId);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  if (authWallet && session.userId) {
    const user = await dbOps.getUserByWallet(authWallet);
    if (!user || user.id !== session.userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }

  const { isPublic } = await c.req.json();
  const updatedSession = await dbOps.toggleSessionPrivacy(sessionId, isPublic);
  return c.json({ session: updatedSession });
});

// ----------------------------------------------------------------------------
// ANKY ENDPOINTS
// ----------------------------------------------------------------------------

// Create anky for a session (optional auth)
app.post("/ankys", optionalAuthMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const params = await c.req.json();
  const authWallet = getAuthWallet(c);

  // Auto-assign userId from auth if not provided
  if (authWallet && !params.userId) {
    const user = await dbOps.getUserByWallet(authWallet);
    if (user) {
      params.userId = user.id;
    }
  }

  if (!params.writingSessionId) {
    return c.json({ error: "writingSessionId required" }, 400);
  }

  const anky = await dbOps.createAnky(params);
  return c.json({ anky });
});

// Update anky (requires auth)
app.patch("/ankys/:ankyId", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const ankyId = c.req.param("ankyId");
  const authWallet = getAuthWallet(c);
  const updates = await c.req.json();

  // Verify ownership (would need to fetch anky and check userId)
  // For now, trust that the frontend sends correct ankyId for the user

  const anky = await dbOps.updateAnky(ankyId, updates);
  return c.json({ anky });
});

// Get anky by session ID (public)
app.get("/sessions/:sessionId/anky", async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const sessionId = c.req.param("sessionId");
  const anky = await dbOps.getAnkyBySession(sessionId);

  if (!anky) {
    return c.json({ error: "Anky not found" }, 404);
  }

  return c.json({ anky });
});

// Record mint (requires auth)
app.post("/ankys/:ankyId/mint", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const ankyId = c.req.param("ankyId");
  const { txHash, tokenId } = await c.req.json();

  if (!txHash || tokenId === undefined) {
    return c.json({ error: "txHash and tokenId required" }, 400);
  }

  const anky = await dbOps.recordMint(ankyId, txHash, tokenId);
  return c.json({ anky });
});

// Get public anky feed (public)
app.get("/feed", async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  const ankys = await dbOps.getPublicAnkyFeed(limit, offset);

  return c.json({ ankys });
});

// ----------------------------------------------------------------------------
// CONVERSATION ENDPOINTS
// ----------------------------------------------------------------------------

// Get or create conversation (optional auth)
app.post("/conversations", optionalAuthMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const body = await c.req.json();
  const authWallet = getAuthWallet(c);

  // Auto-assign userId from auth if not provided
  let userId = body.userId;
  if (authWallet && !userId) {
    const user = await dbOps.getUserByWallet(authWallet);
    if (user) {
      userId = user.id;
    }
  }

  const conversation = await dbOps.getOrCreateConversation({
    userId,
    writingSessionId: body.writingSessionId,
  });

  return c.json({ conversation });
});

// Add message to conversation (optional auth)
app.post(
  "/conversations/:conversationId/messages",
  optionalAuthMiddleware,
  async (c) => {
    if (!isDatabaseAvailable()) {
      return c.json({ error: "Database not available" }, 503);
    }

    const conversationId = c.req.param("conversationId");
    const { role, content } = await c.req.json();

    if (!role || !content) {
      return c.json({ error: "role and content required" }, 400);
    }

    const result = await dbOps.addMessage(conversationId, role, content);

    if (!result) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    if (result.capped) {
      return c.json({
        capped: true,
        message: "You've talked enough here. Start a new conversation?",
      });
    }

    return c.json({ message: result.message });
  },
);

// Get conversation messages (public for now)
app.get("/conversations/:conversationId/messages", async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const conversationId = c.req.param("conversationId");
  const limit = parseInt(c.req.query("limit") || "100");
  const messages = await dbOps.getConversationMessages(conversationId, limit);

  return c.json({ messages });
});

// Close conversation (requires auth)
app.post("/conversations/:conversationId/close", authMiddleware, async (c) => {
  if (!isDatabaseAvailable()) {
    return c.json({ error: "Database not available" }, 503);
  }

  const conversationId = c.req.param("conversationId");
  const conversation = await dbOps.closeConversation(conversationId);

  return c.json({ conversation });
});

export default app;
