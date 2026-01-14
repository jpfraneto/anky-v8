type PinataAuth = { jwt?: string; apiKey?: string; apiSecret?: string };

function getPinataAuth(): PinataAuth | null {
  const jwt = process.env.PINATA_JWT;
  if (jwt) return { jwt };

  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;
  if (apiKey && apiSecret) return { apiKey, apiSecret };

  return null;
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

export function buildIpfsGatewayUrl(cid: string): string {
  const gateway = process.env.PINATA_GATEWAY_URL ?? "https://gateway.pinata.cloud/ipfs";
  return `${gateway}/${cid}`;
}

export function isIpfsConfigured(): boolean {
  return getPinataAuth() !== null;
}

export async function pinJsonToIpfs(content: unknown, name: string): Promise<string> {
  const auth = getPinataAuth();
  if (!auth) {
    throw new Error("IPFS not configured");
  }

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
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
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Pinata JSON upload failed: ${details}`);
  }

  const data = (await response.json()) as { IpfsHash: string };
  return data.IpfsHash;
}

export async function pinFileToIpfs(base64: string, filename: string): Promise<string> {
  const auth = getPinataAuth();
  if (!auth) {
    throw new Error("IPFS not configured");
  }

  const buffer = Buffer.from(base64, "base64");
  const file = new Blob([buffer], { type: "image/png" });
  const formData = new FormData();

  formData.append("file", file, filename);
  formData.append("pinataMetadata", JSON.stringify({ name: filename }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: pinataHeaders(auth),
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Pinata file upload failed: ${details}`);
  }

  const data = (await response.json()) as { IpfsHash: string };
  return data.IpfsHash;
}

export interface UploadResult {
  writingSessionIpfs: string;
  imageIpfs: string;
  tokenUri: string;
}

export async function uploadToIpfs(
  writingSession: string,
  imageBase64: string,
  title: string,
  reflection: string,
  imagePrompt: string,
  walletAddress?: string
): Promise<UploadResult> {
  const uploadId = Date.now();

  // Upload writing session
  const writingSessionIpfs = await pinJsonToIpfs(
    {
      writingSession,
      createdAt: new Date().toISOString(),
    },
    `anky-writing-${uploadId}`
  );

  // Upload image
  const imageIpfs = await pinFileToIpfs(imageBase64, `anky-image-${uploadId}.png`);

  // Upload metadata
  const tokenUri = await pinJsonToIpfs(
    {
      name: title,
      description: reflection,
      image: `ipfs://${imageIpfs}`,
      external_url: "https://anky.bot",
      attributes: [
        { trait_type: "image_prompt", value: imagePrompt },
        { trait_type: "writer", value: walletAddress ?? "unknown" },
      ],
      properties: {
        writing_session: `ipfs://${writingSessionIpfs}`,
      },
    },
    `anky-metadata-${uploadId}`
  );

  return { writingSessionIpfs, imageIpfs, tokenUri };
}
