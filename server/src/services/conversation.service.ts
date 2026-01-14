import { prisma } from "../models/index.js";

export interface CreateConversationData {
  userId: string;
  writingSessionId: string;
  title?: string;
  reflection?: string;
  imagePrompt?: string;
  imageUrl?: string;
  imageIpfs?: string;
  writingIpfs?: string;
  tokenUri?: string;
}

export async function createConversation(data: CreateConversationData) {
  return prisma.conversation.create({
    data: {
      userId: data.userId,
      writingSessionId: data.writingSessionId,
      title: data.title,
      reflection: data.reflection,
      imagePrompt: data.imagePrompt,
      imageUrl: data.imageUrl,
      imageIpfs: data.imageIpfs,
      writingIpfs: data.writingIpfs,
      tokenUri: data.tokenUri,
    },
    include: {
      writingSession: true,
      messages: true,
    },
  });
}

export async function getConversationById(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      writingSession: true,
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getConversationsByUser(userId: string, limit: number = 50) {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      writingSession: {
        select: {
          id: true,
          duration: true,
          wordCount: true,
          isComplete: true,
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function updateConversation(
  conversationId: string,
  data: Partial<CreateConversationData>
) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data,
    include: {
      writingSession: true,
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function deleteConversation(conversationId: string) {
  return prisma.conversation.delete({
    where: { id: conversationId },
  });
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  return prisma.message.create({
    data: {
      conversationId,
      role,
      content,
    },
  });
}

export async function getMessages(conversationId: string) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
}

export async function recordMint(conversationId: string, tokenId: number) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { mintedTokenId: tokenId },
  });
}
