import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

let ANKY_REFERENCES: string[] = [];

export function initAnkyReferences(): void {
  console.log("[ANKY REFERENCES] Initializing reference image loader...");
  // Look for references in server/public/references when running from server dir
  // or in public/references when running from root
  let referencesDir = join(process.cwd(), "public", "references");
  if (!existsSync(referencesDir)) {
    referencesDir = join(process.cwd(), "server", "public", "references");
  }
  console.log(`[ANKY REFERENCES] Looking in directory: ${referencesDir}`);

  const referenceFiles = ["anky-1.png", "anky-2.png", "anky-3.png"];
  ANKY_REFERENCES = [];

  for (const file of referenceFiles) {
    const filePath = join(referencesDir, file);
    if (existsSync(filePath)) {
      try {
        const imageBuffer = readFileSync(filePath);
        const base64Data = imageBuffer.toString("base64");
        ANKY_REFERENCES.push(base64Data);
        const sizeKB = Math.round(imageBuffer.length / 1024);
        console.log(`✓ Loaded reference: ${file} (${sizeKB}KB)`);
      } catch (e) {
        console.warn(`✗ Failed to load ${file}:`, e);
      }
    }
  }

  console.log(`[ANKY REFERENCES] Total loaded: ${ANKY_REFERENCES.length} reference images`);
}

export async function generateImage(prompt: string): Promise<{ url: string; base64: string }> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required");
  }

  const fullPrompt = `Create a mystical fantasy illustration: ${prompt}

CHARACTER - ANKY (follow exactly):
- Blue-skinned creature with large expressive pointed ears
- Purple swirling hair with golden spiral accents
- Golden/amber glowing eyes
- Golden jewelry and decorative accents on body
- Compact body, ancient yet childlike quality

STYLE:
- Rich colors: deep blues, purples, oranges, golds
- Painterly, atmospheric, slightly psychedelic
- Warm mystical lighting
- Fantasy art style, highly detailed`;

  const contents: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  // Add reference images
  for (let i = 0; i < Math.min(ANKY_REFERENCES.length, 4); i++) {
    const ref = ANKY_REFERENCES[i];
    if (ref) {
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: ref,
        },
      });
    }
  }

  // Add context if we have reference images
  if (ANKY_REFERENCES.length > 0) {
    contents.push({
      text: "Reference images above show Anky. Create a NEW image matching this character exactly:",
    });
  }

  contents.push({ text: fullPrompt });

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const model = "gemini-2.5-flash-image";
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("No candidates in Gemini response");
  }

  const firstCandidate = candidates[0];
  if (!firstCandidate?.content?.parts) {
    throw new Error("No parts in Gemini response");
  }

  const imagePart = firstCandidate.content.parts.find(
    (part) =>
      "inlineData" in part &&
      part.inlineData?.mimeType?.startsWith("image/") &&
      part.inlineData?.data
  );

  if (!imagePart || !("inlineData" in imagePart) || !imagePart.inlineData?.data) {
    throw new Error("No image in Gemini response");
  }

  const base64 = imagePart.inlineData.data;
  const mimeType = imagePart.inlineData.mimeType || "image/png";

  return {
    url: `data:${mimeType};base64,${base64}`,
    base64,
  };
}
