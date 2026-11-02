import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { AUTH_EXPIRED, authStatus, loginDemo, logoutDemo } from "../demoAuth";

export default function DemoAccessGate({ children }: { children: ReactNode }) {
  const [required, setRequired] = useState(true);
  const [ready, setReady] = useState(false);
  const [opened, setOpened] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setChecking(true);
    authStatus(controller.signal).then((status) => {
      setRequired(status.required);
      if (!status.required) { setReady(true); setOpened(true); }
      setError("");
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to connect.");
    }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    const expired = () => { setReady(false); setError("Session ended. Enter the demo password to continue. Unsaved workspace changes remain in this tab."); };
    window.addEventListener(AUTH_EXPIRED, expired);
    return () => { controller.abort(); window.removeEventListener(AUTH_EXPIRED, expired); };
  }, [retry]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await loginDemo(password); setPassword(""); setReady(true); setOpened(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Login failed. Try again."); }
    finally { setBusy(false); }
  }

  return <>
    {!ready && <main className="demo-access">
      <form className="demo-access-card" onSubmit={submit} aria-labelledby="demo-access-title">
        <p className="eyebrow">ResilioSpace</p><h1 id="demo-access-title">Mentor demo</h1>
        <p>Enter the shared demo password. Designs are shared with other mentors and storage is temporary. Use sample or non-sensitive plans.</p>
        {checking ? <p role="status">Connecting to the demo…</p> : <>
          <label htmlFor="demo-password">Demo password</label>
          <input id="demo-password" type="password" autoComplete="current-password" autoFocus required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Enter demo"}</button>
          <button type="button" onClick={() => setRetry((value) => value + 1)} disabled={busy}>Retry connection</button>
        </>}
        {error && <p role="alert">{error}</p>}
      </form>
    </main>}
    {opened && <div hidden={!ready}>
      {required && <div className="demo-access-session"><span>Shared demo · temporary storage</span><button type="button" onClick={() => { void logoutDemo().catch(() => undefined); }}>Lock demo</button></div>}
      {children}
    </div>}
  </>;
}
