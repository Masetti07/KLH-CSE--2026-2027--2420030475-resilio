import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DemoAccessGate from "./components/DemoAccessGate";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoAccessGate><App /></DemoAccessGate>
  </StrictMode>,
);
