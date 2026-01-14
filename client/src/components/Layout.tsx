import { Outlet } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import ConversationSidebar from "./ConversationSidebar";
import HamburgerMenu from "./HamburgerMenu";
import { api } from "../lib/api";

export default function Layout() {
  const { authenticated, getAccessToken } = usePrivy();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set API token when authenticated
  useEffect(() => {
    async function setApiToken() {
      if (authenticated) {
        try {
          const token = await getAccessToken();
          api.setToken(token);
        } catch (error) {
          console.error("Failed to get access token:", error);
        }
      } else {
        api.setToken(null);
      }
    }
    setApiToken();
  }, [authenticated, getAccessToken]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - hidden on mobile unless open */}
      <ConversationSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="fixed top-0 right-0 z-40 p-4 flex items-center gap-3">
          <HamburgerMenu onOpenSidebar={() => setSidebarOpen(true)} />
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
