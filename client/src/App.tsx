import { Routes, Route } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import Home from "./pages/Home";
import Conversation from "./pages/Conversation";
import Settings from "./pages/Settings";
import Layout from "./components/Layout";

function App() {
  const { ready } = usePrivy();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="conversation/:id" element={<Conversation />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
