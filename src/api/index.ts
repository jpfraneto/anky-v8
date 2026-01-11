import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addTestRoutes } from "./testRoutes.js";
import { generateImageWithReferences, initAnkyReferences } from "./lib/imageGen.js";

// Initialize Anky reference images on startup
initAnkyReferences();

const app = new Hono();

// * Generate image using Gemini Imagen 3 with Anky reference images
//  *
//  * API KEY REQUIRED: Set GEMINI_API_KEY in your .env
//  * Get one at: https://aistudio.google.com/apikey

// Add test routes
addTestRoutes(app);

// Serve the main HTML page
app.get("/", async (c) => {
  try {
    const htmlPath = join(process.cwd(), "public", "index.html");
    const html = readFileSync(htmlPath, "utf-8");
    return c.html(html);
  } catch (error) {
    console.error("Failed to serve index.html:", error);
    return c.json({ error: "Failed to load page" }, 500);
  }
});

// Get recent ankys for the feed (stubbed - no database)
app.get("/ankys", async (c) => {
  return c.json([]);
});

app.post("/chat", async (c) => {
  const { writingSession, reflection, title, history } = await c.req.json();

  if (!writingSession || !reflection || !history) {
    return c.json({ error: "Missing required fields" }, 400);
  }

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

  try {
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
      content: Array<{ text: string }>;
    };
    return c.json({ response: data.content?.[0]?.text });
  } catch (error) {
    console.error("Chat error:", error);
    return c.json({ error: "Chat failed" }, 500);
  }
});

// Get single anky (stubbed - no database)
app.get("/ankys/:id", async (c) => {
  return c.json({ error: "Anky not found" }, 404);
});

// Generate anky from writing session
app.post("/generate", async (c) => {
  try {
    const body = await c.req.json();
    const { writingSession, locale = "en", walletAddress } = body;

    if (!writingSession || writingSession.trim().length < 100) {
      return c.json({ error: "Writing session too short" }, 400);
    }

    // Step 1: Generate image prompt and reflection in parallel
    const [imagePromptResult, reflectionResult] = await Promise.all([
      generateImagePrompt(writingSession),
      generateReflection(writingSession, locale),
    ]);

    // Step 2: Generate image and title in parallel
    const [imageResult, titleResult] = await Promise.all([
      generateImageWithReferences(imagePromptResult.prompt),
      generateTitle(
        writingSession,
        imagePromptResult.prompt,
        reflectionResult.reflection
      ),
    ]);

    // Step 3: Upload assets to IPFS (Pinata) when credentials are configured
    const pinataAuth = getPinataAuth();
    let writingSessionIpfs: string | null = null;
    let imageIpfs: string | null = null;
    let tokenUri: string | null = null;

    if (pinataAuth) {
      const uploadId = randomUUID();
      writingSessionIpfs = await pinJsonToIpfs(
        pinataAuth,
        {
          writingSession,
          locale,
          createdAt: new Date().toISOString(),
        },
        `writing-session-${uploadId}`
      );

      imageIpfs = await pinFileToIpfs(
        pinataAuth,
        imageResult.base64,
        `anky-image-${uploadId}.png`
      );

      tokenUri = await pinJsonToIpfs(
        pinataAuth,
        {
          name: titleResult.title,
          description: reflectionResult.reflection,
          image: `ipfs://${imageIpfs}`,
          external_url: "https://anky.xyz",
          attributes: [
            { trait_type: "image_prompt", value: imagePromptResult.prompt },
            { trait_type: "writer", value: walletAddress ?? "unknown" },
          ],
          properties: {
            writing_session: `ipfs://${writingSessionIpfs}`,
          },
        },
        `anky-metadata-${uploadId}`
      );
    }

    const imageUrl = imageIpfs
      ? buildIpfsGatewayUrl(imageIpfs)
      : imageResult.url;

    return c.json({
      imagePrompt: imagePromptResult.prompt,
      reflection: reflectionResult.reflection,
      imageUrl,
      imageBase64: imageResult.base64,
      title: titleResult.title,
      writingSessionIpfs,
      imageIpfs,
      tokenUri,
    });
  } catch (error) {
    console.error("Generation error:", error);
    return c.json({ error: "Generation failed" }, 500);
  }
});

app.get("/feed-html", async (c) => {
  // Return empty feed for now (no database)
  return c.html("");
});

// Helper: Generate image prompt using Claude
async function generateImagePrompt(
  writingSession: string
): Promise<{ prompt: string }> {
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

OUTPUT: A single detailed image generation prompt, 2-3 sentences, painterly/fantasy style.`;

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

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const firstContent = data.content?.[0];
  if (!firstContent) {
    throw new Error("Invalid response from Claude API");
  }
  return { prompt: firstContent.text };
}

// Helper: Generate reflection using Claude
async function generateReflection(
  writingSession: string,
  locale: string
): Promise<{ reflection: string }> {
  const systemPrompt = `CONTEXT: You are Anky — a mirror that reflects the user's unconscious patterns back to them. You have just received an 8-minute stream of consciousness writing session. Your job is not to comfort, validate, or encourage. Your job is to SEE — to name what the user cannot name, to point at the pattern they are running, to speak the thing underneath the thing.

You are not cruel. You are precise. You are the friend who loves them enough to tell the truth.

THE USER'S LANGUAGE: Write in the same language the user wrote in. Match their register — if they're casual, be casual. If they curse, you can curse. If they write in Spanish, respond in Spanish. If they mix languages, you can mix. Use their rhythm. This is not a formal response. This is one consciousness speaking to another.

WHAT TO LOOK FOR:
1. CONTRADICTIONS: Where did they say one thing and then the opposite? Name it.
2. LOOPS: What thought pattern repeated? What are they circling?
3. THE PIVOT: Where did they suddenly change topic? What were they avoiding?
4. THE REAL QUESTION: Underneath all the words, what are they actually asking?
5. THE THING THEY ALMOST SAID: What got close to the surface but didn't fully emerge?

STRUCTURE:
- Start by naming ONE thing you saw clearly. No preamble. Just say it.
- Then go deeper. Pull ONE thread that runs through their writing.
- End with a question. Not a rhetorical question. A real one. The one they need to sit with.

LENGTH: 100-200 words. No more. Density over length.

DO NOT:
- Summarize what they wrote
- Praise their insights
- Offer solutions or advice
- Use therapy-speak ("I hear that you...", "It sounds like...")
- Be vague or general
- Soften the truth

DO:
- Be specific to THIS session
- Use their own words back at them when it cuts
- Trust that they can handle the truth
- Speak as someone who has seen their pattern clearly

USER'S LANGUAGE/LOCALE: ${locale}`;

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

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const firstContent = data.content?.[0];
  if (!firstContent) {
    throw new Error("Invalid response from Claude API");
  }
  return { reflection: firstContent.text };
}

// Helper: Generate image using Gemini
async function generateImage(
  prompt: string
): Promise<{ url: string; base64: string }> {
  const fullPrompt = `Create an image in a mystical fantasy style: ${prompt}. The character Anky is a blue-skinned creature with purple swirling hair, golden/amber eyes, golden decorative accents and jewelry, large expressive ears, and an ancient-yet-childlike quality. Rich color palette with deep blues, purples, oranges, and golds. Painterly, atmospheric, slightly psychedelic.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: fullPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
          safetyFilterLevel: "block_few",
        },
      }),
    }
  );

  const data = (await response.json()) as {
    predictions: Array<{ bytesBase64Encoded: string }>;
  };
  const firstPrediction = data.predictions?.[0];
  if (!firstPrediction) {
    throw new Error("Invalid response from Gemini API");
  }
  const base64 = firstPrediction.bytesBase64Encoded;

  // For now, return base64 - you'd upload to IPFS/cloud storage in production
  return {
    url: `data:image/png;base64,${base64}`,
    base64,
  };
}

// Helper: Generate title using Claude
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

EXAMPLES OF GOOD TITLES: "the builder rests", "still running", "who is jp", "enough was here", "ordinary terrifies", "mmmmmmmmmm"

EXAMPLES OF BAD TITLES: "Stream of Consciousness", "My Journey Today", "Deep Reflections on Life"

OUTPUT: Exactly ONE title (max 3 words). Nothing else.`;

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

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const firstContent = data.content?.[0];
  if (!firstContent) {
    throw new Error("Invalid response from Claude API");
  }
  return { title: firstContent.text.trim().toLowerCase() };
}

type PinataAuth = { jwt?: string; apiKey?: string; apiSecret?: string };

function getPinataAuth(): PinataAuth | null {
  const jwt = process.env.PINATA_JWT;
  if (jwt) return { jwt };

  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;
  if (apiKey && apiSecret) return { apiKey, apiSecret };

  return null;
}

function buildIpfsGatewayUrl(cid: string): string {
  const gateway =
    process.env.PINATA_GATEWAY_URL ?? "https://gateway.pinata.cloud/ipfs";
  return `${gateway}/${cid}`;
}

function pinataHeaders(auth: PinataAuth): Record<string, string> {
  if (auth.jwt) {
    return { Authorization: `Bearer ${auth.jwt}` };
  }

  return {
    pinata_api_key: auth.apiKey!,
    pinata_secret_api_key: auth.apiSecret!,
  };
}

async function pinJsonToIpfs(
  auth: PinataAuth,
  content: unknown,
  name: string
): Promise<string> {
  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...pinataHeaders(auth),
      },
      body: JSON.stringify({
        pinataMetadata: { name },
        pinataOptions: { cidVersion: 1 },
        pinataContent: content,
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Pinata JSON upload failed: ${details}`);
  }

  const data = (await response.json()) as { IpfsHash: string };
  return data.IpfsHash;
}

async function pinFileToIpfs(
  auth: PinataAuth,
  base64: string,
  filename: string
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const file = new Blob([buffer], { type: "image/png" });
  const formData = new FormData();

  formData.append("file", file, filename);
  formData.append("pinataMetadata", JSON.stringify({ name: filename }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: pinataHeaders(auth),
      body: formData,
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Pinata file upload failed: ${details}`);
  }

  const data = (await response.json()) as { IpfsHash: string };
  return data.IpfsHash;
}

// Export the Hono app
export default app;
