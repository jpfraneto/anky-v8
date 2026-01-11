import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateImageWithReferences } from "./lib/imageGen";

const TEST_SECRET = "1234567890"; // Change this

export function addTestRoutes(app: Hono): void {
  // Serve test dashboard (protected by secret in URL)
  app.get(`/test/${TEST_SECRET}`, async (c) => {
    try {
      const htmlPath = join(process.cwd(), "public", "test-dashboard.html");
      const html = readFileSync(htmlPath, "utf-8");
      return c.html(html);
    } catch (error) {
      return c.text("Dashboard not found", 404);
    }
  });

  // Step 1: Generate Image Prompt
  app.post("/test/prompt", async (c) => {
    console.log("[TEST ROUTE] /api/test/prompt - Request received");
    const { writingSession } = await c.req.json();
    console.log(`[TEST ROUTE] Writing session length: ${writingSession?.length || 0} chars`);

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

    console.log("[TEST ROUTE] Calling Claude API for image prompt...");
    const startTime = Date.now();
    
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

    const responseTime = Date.now() - startTime;
    console.log(`[TEST ROUTE] Claude API responded in ${responseTime}ms (status: ${response.status})`);

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
    };
    const firstContent = data.content?.[0];
    if (!firstContent) {
      console.error("[TEST ROUTE] ❌ No content in Claude response");
      throw new Error("Invalid response from Claude API");
    }
    
    const promptText = firstContent.text;
    console.log(`[TEST ROUTE] ✓ Generated prompt (${promptText.length} chars): "${promptText.substring(0, 100)}..."`);
    
    return c.json({ prompt: promptText });
  });

  // Step 2: Generate Reflection
  app.post("/test/reflection", async (c) => {
    console.log("[TEST ROUTE] /api/test/reflection - Request received");
    const { writingSession, locale = "en" } = await c.req.json();
    console.log(`[TEST ROUTE] Writing session length: ${writingSession?.length || 0} chars, locale: ${locale}`);

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

    console.log("[TEST ROUTE] Calling Claude API for reflection...");
    const startTime = Date.now();
    
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

    const responseTime = Date.now() - startTime;
    console.log(`[TEST ROUTE] Claude API responded in ${responseTime}ms (status: ${response.status})`);

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
    };
    const firstContent = data.content?.[0];
    if (!firstContent) {
      console.error("[TEST ROUTE] ❌ No content in Claude response");
      throw new Error("Invalid response from Claude API");
    }
    
    const reflectionText = firstContent.text;
    console.log(`[TEST ROUTE] ✓ Generated reflection (${reflectionText.length} chars): "${reflectionText.substring(0, 100)}..."`);
    
    return c.json({ reflection: reflectionText });
  });

  // Step 3: Generate Image
  app.post("/test/image", async (c) => {
    console.log("[TEST ROUTE] /api/test/image - Request received");
    const { prompt } = await c.req.json();
    console.log(`[TEST ROUTE] Prompt length: ${prompt?.length || 0} chars`);
    console.log(`[TEST ROUTE] Prompt preview: "${prompt?.substring(0, 100)}..."`);

    const startTime = Date.now();
    const result = await generateImageWithReferences(prompt);
    const generationTime = Date.now() - startTime;
    
    console.log(`[TEST ROUTE] ✓ Image generated in ${generationTime}ms`);
    console.log(`[TEST ROUTE] Image base64 length: ${result.base64.length} chars`);
    
    return c.json(result);
  });

  // Step 4: Generate Title
  app.post("/test/title", async (c) => {
    console.log("[TEST ROUTE] /api/test/title - Request received");
    const { writingSession, imagePrompt, reflection } = await c.req.json();
    console.log(`[TEST ROUTE] Writing session: ${writingSession?.length || 0} chars`);
    console.log(`[TEST ROUTE] Image prompt: ${imagePrompt?.length || 0} chars`);
    console.log(`[TEST ROUTE] Reflection: ${reflection?.length || 0} chars`);

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

    console.log("[TEST ROUTE] Calling Claude API for title...");
    const startTime = Date.now();
    
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

    const responseTime = Date.now() - startTime;
    console.log(`[TEST ROUTE] Claude API responded in ${responseTime}ms (status: ${response.status})`);

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
    };
    const firstContent = data.content?.[0];
    if (!firstContent) {
      console.error("[TEST ROUTE] ❌ No content in Claude response");
      throw new Error("Invalid response from Claude API");
    }
    
    const rawTitle = firstContent.text.trim().toLowerCase().replace(/['"]/g, "");
    console.log(`[TEST ROUTE] ✓ Generated title: "${rawTitle}"`);
    
    return c.json({
      title: rawTitle,
    });
  });

  // Step 5: IPFS Upload (optional)
  app.post("/test/ipfs", async (c) => {
    console.log("[TEST ROUTE] /api/test/ipfs - Request received");
    const { writingSession, imageBase64, title, reflection, imagePrompt } =
      await c.req.json();
    console.log(`[TEST ROUTE] Image base64 length: ${imageBase64?.length || 0} chars`);
    console.log(`[TEST ROUTE] Title: "${title}"`);

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      console.log("[TEST ROUTE] ⚠️  IPFS not configured (PINATA_JWT missing)");
      return c.json({ error: "IPFS not configured" }, 400);
    }
    console.log("[TEST ROUTE] PINATA_JWT found, proceeding with IPFS upload...");

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
      }
    );
    const writingData = (await writingResponse.json()) as {
      IpfsHash: string;
    };
    const writingSessionIpfs = writingData.IpfsHash;

    // Upload image
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const imageBlob = new Blob([imageBuffer], { type: "image/png" });
    const formData = new FormData();
    formData.append("file", imageBlob, `anky-image-${Date.now()}.png`);
    formData.append(
      "pinataMetadata",
      JSON.stringify({ name: `anky-image-${Date.now()}` })
    );

    const imageResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${pinataJwt}` },
        body: formData,
      }
    );
    const imageData = (await imageResponse.json()) as {
      IpfsHash: string;
    };
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
      }
    );
    const metadataData = (await metadataResponse.json()) as {
      IpfsHash: string;
    };
    const tokenUri = metadataData.IpfsHash;

    console.log(`[TEST ROUTE] ✓ IPFS upload complete:`);
    console.log(`[TEST ROUTE]   - Writing session: ${writingSessionIpfs}`);
    console.log(`[TEST ROUTE]   - Image: ${imageIpfs}`);
    console.log(`[TEST ROUTE]   - Token URI: ${tokenUri}`);

    return c.json({ writingSessionIpfs, imageIpfs, tokenUri });
  });

  // Chat with Anky (continues the conversation)
  app.post("/test/chat", async (c) => {
    console.log("[TEST ROUTE] /api/test/chat - Request received");
    const { writingSession, reflection, title, history } = await c.req.json();
    console.log(`[TEST ROUTE] Chat history length: ${history?.length || 0} messages`);
    if (history && history.length > 0) {
      const lastMessage = history[history.length - 1];
      console.log(`[TEST ROUTE] Last message: ${lastMessage.role} - "${lastMessage.content?.substring(0, 50)}..."`);
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

    console.log("[TEST ROUTE] Calling Claude API for chat response...");
    const startTime = Date.now();
    
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

    const responseTime = Date.now() - startTime;
    console.log(`[TEST ROUTE] Claude API responded in ${responseTime}ms (status: ${response.status})`);

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
    };
    const firstContent = data.content?.[0];
    if (!firstContent) {
      console.error("[TEST ROUTE] ❌ No content in Claude response");
      throw new Error("Invalid response from Claude API");
    }
    
    const chatResponse = firstContent.text;
    console.log(`[TEST ROUTE] ✓ Generated chat response (${chatResponse.length} chars): "${chatResponse.substring(0, 100)}..."`);
    
    return c.json({ response: chatResponse });
  });
}
