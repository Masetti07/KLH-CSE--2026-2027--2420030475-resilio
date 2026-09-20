import { useState } from "react";
import Workspace from "./components/Workspace";

export default function App() {
  const [startRequest, setStartRequest] = useState(0);
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="#top" aria-label="ResilioSpace home"><span className="brand-mark" aria-hidden="true">R</span><span>ResilioSpace</span></a><span className="phase-badge">Editable residential plans</span></header>
    <main id="top">
      <section className="intro-hero" aria-labelledby="intro-title">
        <div className="intro-copy">
          <p className="eyebrow">ResilioSpace</p>
          <h1 id="intro-title">From floor plan<br />to <em>living space.</em></h1>
          <p className="intro-lede">Design, visualize and explore your home before it becomes reality.</p>
          <p className="intro-detail">Transform an existing 2D floor plan or create a simple residential layout from scratch. Explore it in interactive 3D, personalize your space, review traditional Vastu rules, and experience a system that adapts and recovers when runtime problems occur.</p>
          <a className="primary-button intro-cta" href="#workspace" onClick={() => setStartRequest((value) => value + 1)}>Start Designing <span aria-hidden="true">↓</span></a>
          <div className="intro-process" aria-label="Design journey"><span>Create</span><span>Visualize</span><span>Personalize</span><span>Analyze</span></div>
        </div>
        <div className="intro-scene" aria-hidden="true">
          <div className="scene-sunlight" /><div className="scene-window"><span /></div>
          <div className="scene-art"><span /></div><div className="scene-lamp" />
          <div className="scene-plant"><i /><i /><i /><i /><i /></div>
          <div className="scene-sofa"><div className="scene-sofa-back" /><div className="scene-sofa-seat" /><span className="cushion-one" /><span className="cushion-two" /></div>
          <div className="scene-table"><span /></div>
        </div>
      </section>
      <Workspace startRequest={startRequest} />
    </main>
    <footer>ResilioSpace · Best-effort reconstruction for supported clean, orthogonal plans.</footer>
  </div>;
}
