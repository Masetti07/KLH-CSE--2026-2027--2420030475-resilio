import Workspace from "./components/Workspace";

export default function App() {
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="#workspace" aria-label="ResilioSpace home"><span className="brand-mark" aria-hidden="true">R</span><span>ResilioSpace</span></a><span className="phase-badge">Editable residential plans</span></header>
    <main><Workspace /></main>
    <footer>ResilioSpace · Best-effort reconstruction for supported clean, orthogonal plans.</footer>
  </div>;
}
