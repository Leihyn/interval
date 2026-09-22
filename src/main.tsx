import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App.tsx";
import Setup from "./Setup.tsx";
import "./App.css";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {url ? (
      <ConvexProvider client={new ConvexReactClient(url)}>
        <App />
      </ConvexProvider>
    ) : (
      <Setup />
    )}
  </StrictMode>,
);
