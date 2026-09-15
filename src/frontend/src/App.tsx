import { useState } from "react";
import Workspace from "./components/Workspace";

const workflow = ["Upload", "Detect", "Correct", "Visualize", "Design", "Analyze"];

function App() {
  const [workspaceVisible, setWorkspaceVisible] = useState(false);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="ResilioSpace home">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>ResilioSpace</span>
        </a>
        <span className="phase-badge">Day 4 · adaptive prototype</span>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Floor plans, made spatial</p>
            <h1 id="hero-title">From drawing to a structure you can understand.</h1>
            <p className="lede">Upload a clean residential floor plan, correct its structural model, and explore a simplified interactive 3D reconstruction. Detection confidence stays visible because uncertain geometry should never pretend to be exact.</p>
            <button className="primary-button" onClick={() => { setWorkspaceVisible(true); requestAnimationFrame(() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" })); }}>
              Open workspace <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="hero-plan" aria-label="Abstract architectural floor-plan illustration">
            <div className="plan-room room-a"><span>living</span></div>
            <div className="plan-room room-b"><span>sleep</span></div>
            <div className="plan-room room-c"><span>cook</span></div>
            <div className="plan-node node-a" /><div className="plan-node node-b" /><div className="plan-node node-c" />
          </div>
        </section>

        <section className="workflow-section" aria-labelledby="workflow-title">
          <p className="eyebrow">The planned journey</p>
          <h2 id="workflow-title">One model, six clear steps</h2>
          <ol className="workflow-list">
            {workflow.map((step, index) => (
              <li key={step} className={index < 6 ? "available" : "planned"}>
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
                <small>{index < 2 ? "Day 1" : index < 4 ? "Day 2" : "Day 3"}</small>
              </li>
            ))}
          </ol>
        </section>

        {workspaceVisible ? <Workspace /> : (
          <section className="workspace-invite" aria-label="Workspace invitation">
            <p>Ready to inspect a plan?</p>
            <button className="secondary-button" onClick={() => setWorkspaceVisible(true)}>Launch processing workspace</button>
          </section>
        )}
      </main>
      <footer>ResilioSpace · Best-effort reconstruction for supported clean, orthogonal plans.</footer>
    </div>
  );
}

export default App;
