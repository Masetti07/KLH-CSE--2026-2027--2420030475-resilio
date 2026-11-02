import { useEffect, useState } from "react";
import { apiFetch, AUTH_READY } from "../demoAuth";

export default function ApiImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [session, setSession] = useState(0);
  useEffect(() => {
    const refresh = () => setSession((value) => value + 1);
    window.addEventListener(AUTH_READY, refresh);
    return () => window.removeEventListener(AUTH_READY, refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setUrl(""); setError(false);
    apiFetch(src, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Image unavailable");
      const blob = await response.blob();
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, session]);
  return url ? <img className={className} src={url} alt={alt} /> : <p role={error ? "alert" : "status"}>{error ? "Processed image unavailable. Try another view or sign in again." : "Loading processed image…"}</p>;
}
