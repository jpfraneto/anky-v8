import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { api, Conversation } from "../lib/api";

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConversationSidebar({
  isOpen,
  onClose,
}: ConversationSidebarProps) {
  const { authenticated } = usePrivy();
  const navigate = useNavigate();
  const { id: currentId } = useParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authenticated) {
      loadConversations();
    }
  }, [authenticated]);

  async function loadConversations() {
    setLoading(true);
    try {
      const { conversations } = await api.getConversations();
      setConversations(conversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-72 bg-bg border-r border-white/10
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          lg:block
        `}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <Link to="/" className="text-xl font-semibold text-primary">
                anky
              </Link>
              <button
                onClick={onClose}
                className="lg:hidden w-8 h-8 flex items-center justify-center rounded hover:bg-white/5"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* New Session Button */}
            <button
              onClick={() => {
                navigate("/");
                onClose();
              }}
              className="w-full mt-4 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Session
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2">
            {!authenticated ? (
              <div className="p-4 text-center text-muted text-sm">
                Connect your wallet to see your conversations
              </div>
            ) : loading ? (
              <div className="p-4 text-center text-muted text-sm">
                Loading...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted text-sm">
                No conversations yet. Start writing!
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <Link
                    key={conv.id}
                    to={`/conversation/${conv.id}`}
                    onClick={onClose}
                    className={`
                      block p-3 rounded-lg transition-colors
                      ${
                        currentId === conv.id
                          ? "bg-primary/20 text-primary"
                          : "hover:bg-white/5"
                      }
                    `}
                  >
                    <div className="font-medium truncate">
                      {conv.title || "Untitled"}
                    </div>
                    <div className="text-xs text-muted mt-1 flex items-center gap-2">
                      <span>{formatDate(conv.createdAt)}</span>
                      {conv.writingSession.isComplete && (
                        <span className="text-primary">8min</span>
                      )}
                      {conv.mintedTokenId && (
                        <span className="text-gold">minted</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
