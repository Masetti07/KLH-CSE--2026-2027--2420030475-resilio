import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DemoAccessGate from "./components/DemoAccessGate";
import { GUEST_DEMO } from "./demoAuth";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {GUEST_DEMO ? <><div className="demo-access-session">Public guest demo · designs stay in this browser · uploads are processed temporarily · administrative simulations unavailable</div><App /></> : <DemoAccessGate><App /></DemoAccessGate>}
  </StrictMode>,
);
