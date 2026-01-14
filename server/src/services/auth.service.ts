import * as jose from "jose";
import { prisma } from "../models/index.js";

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_JWKS_URL = `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`;

let jwks: jose.JWTVerifyGetKey | null = null;

async function getJWKS(): Promise<jose.JWTVerifyGetKey> {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(PRIVY_JWKS_URL));
  }
  return jwks;
}

export interface PrivyTokenPayload {
  sub: string; // Privy user ID (did:privy:...)
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  sid?: string;
  linked_accounts?: Array<{
    type: string;
    address?: string;
    chain_type?: string;
  }>;
}

export async function verifyPrivyToken(token: string): Promise<PrivyTokenPayload> {
  const jwksClient = await getJWKS();

  const { payload } = await jose.jwtVerify(token, jwksClient, {
    issuer: "privy.io",
    audience: PRIVY_APP_ID,
  });

  return payload as unknown as PrivyTokenPayload;
}

export async function getOrCreateUser(privyPayload: PrivyTokenPayload) {
  const privyId = privyPayload.sub;

  // Extract wallet address from linked accounts
  const walletAccount = privyPayload.linked_accounts?.find(
    (acc) => acc.type === "wallet" && acc.chain_type === "ethereum"
  );
  const walletAddress = walletAccount?.address ?? null;

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { privyId },
    include: { settings: true },
  });

  if (!user) {
    // Create new user with default settings
    user = await prisma.user.create({
      data: {
        privyId,
        walletAddress,
        settings: {
          create: {
            fontFamily: "Inter",
            fontSize: 16,
            primaryColor: "#a855f7",
            bgColor: "#050506",
          },
        },
      },
      include: { settings: true },
    });
  } else if (walletAddress && user.walletAddress !== walletAddress) {
    // Update wallet address if changed
    user = await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress },
      include: { settings: true },
    });
  }

  return user;
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });
}

export async function updateUserSettings(
  userId: string,
  settings: {
    fontFamily?: string;
    fontSize?: number;
    primaryColor?: string;
    bgColor?: string;
  }
) {
  return prisma.userSettings.upsert({
    where: { userId },
    update: settings,
    create: {
      userId,
      ...settings,
    },
  });
}
