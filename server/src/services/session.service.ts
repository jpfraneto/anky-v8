import { prisma } from "../models/index.js";

export interface CreateSessionData {
  userId: string;
  content: string;
  duration: number;
  wordCount: number;
  wpm: number;
  backspaceCount?: number;
  enterCount?: number;
  arrowCount?: number;
}

export async function createSession(data: CreateSessionData) {
  const isComplete = data.duration >= 480; // 8 minutes

  return prisma.writingSession.create({
    data: {
      userId: data.userId,
      content: data.content,
      duration: data.duration,
      wordCount: data.wordCount,
      wpm: data.wpm,
      backspaceCount: data.backspaceCount ?? 0,
      enterCount: data.enterCount ?? 0,
      arrowCount: data.arrowCount ?? 0,
      isComplete,
    },
  });
}

export async function getSessionById(sessionId: string) {
  return prisma.writingSession.findUnique({
    where: { id: sessionId },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
}

export async function getSessionsByUser(userId: string, limit: number = 50) {
  return prisma.writingSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      conversation: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
}

export async function deleteSession(sessionId: string) {
  return prisma.writingSession.delete({
    where: { id: sessionId },
  });
}
