const API_BASE = import.meta.env.VITE_API_URL || "/api";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  }

  // Auth
  async verifyToken(token: string) {
    return this.fetch<{ user: User }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  async getMe() {
    return this.fetch<{ user: User }>("/auth/me");
  }

  async updateSettings(settings: Partial<UserSettings>) {
    return this.fetch<{ settings: UserSettings }>("/auth/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  // Sessions
  async createSession(data: CreateSessionData) {
    return this.fetch<{ session: WritingSession }>("/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSessions(limit?: number) {
    const query = limit ? `?limit=${limit}` : "";
    return this.fetch<{ sessions: WritingSession[] }>(`/sessions${query}`);
  }

  async getSession(id: string) {
    return this.fetch<{ session: WritingSession }>(`/sessions/${id}`);
  }

  // Conversations
  async createConversation(data: CreateConversationData) {
    return this.fetch<{ conversation: Conversation }>("/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getConversations(limit?: number) {
    const query = limit ? `?limit=${limit}` : "";
    return this.fetch<{ conversations: Conversation[] }>(`/conversations${query}`);
  }

  async getConversation(id: string) {
    return this.fetch<{ conversation: Conversation }>(`/conversations/${id}`);
  }

  async deleteConversation(id: string) {
    return this.fetch<{ success: boolean }>(`/conversations/${id}`, {
      method: "DELETE",
    });
  }

  async sendMessage(conversationId: string, message: string) {
    return this.fetch<{ message: Message; response: string }>(
      `/conversations/${conversationId}/chat`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      }
    );
  }

  async recordMint(conversationId: string, tokenId: number) {
    return this.fetch<{ conversation: Conversation }>(
      `/conversations/${conversationId}/mint`,
      {
        method: "POST",
        body: JSON.stringify({ tokenId }),
      }
    );
  }

  // Generation
  async generateFull(writingSessionId: string, locale?: string) {
    return this.fetch<GenerationResult>("/generate/full", {
      method: "POST",
      body: JSON.stringify({ writingSessionId, locale }),
    });
  }

  async generateShort(writingSessionId: string) {
    return this.fetch<{ conversation: Conversation; response: string }>(
      "/generate/short",
      {
        method: "POST",
        body: JSON.stringify({ writingSessionId }),
      }
    );
  }
}

export const api = new ApiClient();

// Types
export interface User {
  id: string;
  privyId: string;
  walletAddress: string | null;
  settings: UserSettings | null;
  createdAt: string;
}

export interface UserSettings {
  id: string;
  fontFamily: string;
  fontSize: number;
  primaryColor: string;
  bgColor: string;
}

export interface WritingSession {
  id: string;
  content: string;
  duration: number;
  wordCount: number;
  wpm: number;
  backspaceCount: number;
  enterCount: number;
  arrowCount: number;
  isComplete: boolean;
  createdAt: string;
  conversation?: {
    id: string;
    title: string | null;
  } | null;
}

export interface Conversation {
  id: string;
  title: string | null;
  reflection: string | null;
  imagePrompt: string | null;
  imageUrl: string | null;
  imageIpfs: string | null;
  writingIpfs: string | null;
  tokenUri: string | null;
  mintedTokenId: number | null;
  createdAt: string;
  writingSession: WritingSession;
  messages: Message[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface CreateSessionData {
  content: string;
  duration: number;
  wordCount: number;
  wpm: number;
  backspaceCount?: number;
  enterCount?: number;
  arrowCount?: number;
}

export interface CreateConversationData {
  writingSessionId: string;
  title?: string;
  reflection?: string;
  imagePrompt?: string;
  imageUrl?: string;
}

export interface GenerationResult {
  conversation: Conversation;
  imagePrompt: string;
  reflection: string;
  title: string;
  imageUrl: string;
  imageBase64: string;
  writingIpfs: string | null;
  imageIpfs: string | null;
  tokenUri: string | null;
}
