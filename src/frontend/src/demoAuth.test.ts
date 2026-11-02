import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AUTH_EXPIRED, API_BASE, apiFetch, authStatus, clearDemoSession, loginDemo, logoutDemo } from "./demoAuth";
import { createStarterPlan, samplePlanFile, uploadPlan } from "./api";
import DemoAccessGate from "./components/DemoAccessGate";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  clearDemoSession();
});
afterEach(() => { clearDemoSession(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const loginResponse = () => new Response(JSON.stringify({ token: "server-issued-token", expires_in: 1800 }));

describe("shared demo access", () => {
  it("checks backend settings and renders a safe, accessible connecting screen", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"required":false}'));
    expect(await authStatus()).toEqual({ required: false });
    const html = renderToStaticMarkup(createElement(DemoAccessGate, { children: createElement("div", null, "Private workspace") }));
    expect(html).toContain("Mentor demo");
    expect(html).toContain('role="status"');
    expect(html).toContain("storage is temporary");
    expect(html).not.toContain("Private workspace");
  });

  it("adds short-lived bearer credentials to JSON and multipart requests, never URLs", async () => {
    fetchMock.mockResolvedValueOnce(loginResponse());
    await loginDemo("mentor-entered-password");
    const loginCall = fetchMock.mock.calls[0];
    expect(loginCall[0]).toBe(`${API_BASE}/api/auth/login`);
    expect(JSON.parse(loginCall[1].body)).toEqual({ password: "mentor-entered-password" });
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    await createStarterPlan("blank");
    expect(fetchMock.mock.calls[1][1].headers.get("Authorization")).toBe("Bearer server-issued-token");
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    await uploadPlan(new File(["plan"], "plan.png", { type: "image/png" }));
    const [url, init] = fetchMock.mock.calls[2];
    expect(url).not.toContain("token");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers.has("Content-Type")).toBe(false);
    expect(init.headers.get("Authorization")).toBe("Bearer server-issued-token");
    fetchMock.mockResolvedValueOnce(new Response("sample", { headers: { "Content-Type": "image/png" } }));
    expect((await samplePlanFile("sample.png")).name).toBe("sample.png");
  });

  it("rejects failed login and refuses to send a token to another destination", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"detail":"Incorrect demo password."}', { status: 401 }));
    await expect(loginDemo("wrong")).rejects.toThrow("Incorrect demo password");
    await expect(apiFetch("https://unrelated.example/data")).rejects.toThrow("Unexpected API destination");
  });

  it("clears credentials on expiry, on server rejection, and on logout", async () => {
    const expired = vi.fn(); window.addEventListener(AUTH_EXPIRED, expired);
    fetchMock.mockResolvedValueOnce(loginResponse()); await loginDemo("password");
    vi.advanceTimersByTime(1800 * 1000);
    expect(expired).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    await apiFetch(`${API_BASE}/api/system/health`);
    expect(fetchMock.mock.calls.at(-1)![1].headers.has("Authorization")).toBe(false);
    fetchMock.mockResolvedValueOnce(loginResponse()); await loginDemo("password");
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await apiFetch(`${API_BASE}/api/system/health`);
    expect(expired).toHaveBeenCalledTimes(2);
    fetchMock.mockResolvedValueOnce(loginResponse()); await loginDemo("password");
    fetchMock.mockResolvedValueOnce(new Response('{}')); await logoutDemo();
    expect(fetchMock.mock.calls.at(-1)![0]).toBe(`${API_BASE}/api/auth/logout`);
    expect(expired).toHaveBeenCalledTimes(3);
  });
});
