import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import "./index.css";

const PRIVY_APP_ID = "cmivv85zt00ftla0cjpaw155h";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#a855f7",
          logo: "/anky.svg",
        },
        loginMethods: ["wallet"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PrivyProvider>
  </React.StrictMode>
);
