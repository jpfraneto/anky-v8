import { Hono } from "hono";
import {
  generateImageWithReferences,
  initAnkyReferences,
} from "./lib/imageGen.js";

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

  const data = (await response.json()) as { content?: Array<{ text: string }>; error?: { message: string } };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(`Claude API error: ${data.error?.message || response.statusText}`);
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

  const data = (await response.json()) as { content?: Array<{ text: string }>; error?: { message: string } };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(`Claude API error: ${data.error?.message || response.statusText}`);
  }

  const firstContent = data.content?.[0];
  if (!firstContent) {
    console.error("Unexpected Claude response:", data);
    throw new Error("Invalid response from Claude API");
  }

  return c.json({ reflection: firstContent.text });
});

// Step 3: Generate Image
app.post("/image", async (c) => {
  const { prompt } = await c.req.json();
  const result = await generateImageWithReferences(prompt);
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

  const data = (await response.json()) as { content?: Array<{ text: string }>; error?: { message: string } };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(`Claude API error: ${data.error?.message || response.statusText}`);
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

  const data = (await response.json()) as { content?: Array<{ text: string }>; error?: { message: string } };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(`Claude API error: ${data.error?.message || response.statusText}`);
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

  const data = (await response.json()) as { content?: Array<{ text: string }>; error?: { message: string } };

  if (!response.ok) {
    console.error("Claude API error:", response.status, data);
    throw new Error(`Claude API error: ${data.error?.message || response.statusText}`);
  }

  const firstContent = data.content?.[0];
  if (!firstContent) {
    console.error("Unexpected Claude response:", data);
    throw new Error("Invalid response from Claude API");
  }

  return c.json({ response: firstContent.text });
});

export default app;
