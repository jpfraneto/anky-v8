import { usePrivy } from "@privy-io/react-auth";
import { Link } from "react-router-dom";
import { useState } from "react";

interface HamburgerMenuProps {
  onOpenSidebar: () => void;
}

export default function HamburgerMenu({ onOpenSidebar }: HamburgerMenuProps) {
  const { authenticated, login, logout, user } = usePrivy();
  const [menuOpen, setMenuOpen] = useState(false);

  const walletAddress = user?.wallet?.address;
  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <div className="flex items-center gap-3">
      {/* Connect Wallet Button */}
      {authenticated ? (
        <button
          onClick={() => logout()}
          className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors"
        >
          {truncatedAddress || "Connected"}
        </button>
      ) : (
        <button
          onClick={() => login()}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Connect Wallet
        </button>
      )}

      {/* Hamburger Button */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-10 h-10 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <span className="w-5 h-0.5 bg-fg rounded-full" />
          <span className="w-5 h-0.5 bg-fg rounded-full" />
          <span className="w-5 h-0.5 bg-fg rounded-full" />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-12 z-50 w-48 bg-bg border border-white/10 rounded-lg shadow-xl overflow-hidden">
              <button
                onClick={() => {
                  onOpenSidebar();
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                Conversations
              </button>
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
