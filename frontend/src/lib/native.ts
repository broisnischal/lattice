/**
 * Thin wrapper over the Native SDK JavaScript bridge.
 *
 * In the packaged desktop app `window.zero.invoke(command, payload)` routes
 * to a Zig handler (see src/main.zig `bridge()`), which is where secure
 * things live: local book storage, OS keychain token storage, file open
 * dialogs, etc. In a plain browser dev session (or on a platform where the
 * bridge is disabled) `window.zero` is absent, so every call falls back to a
 * web-friendly implementation. This lets the whole UI run in Vite without the
 * native shell while keeping a single call site for real native features.
 */

type Zero = {
  /** Resolves with the already-parsed `result` value (an object/string/etc),
   *  or rejects with an Error carrying `.code` on failure. */
  invoke: (command: string, payload?: unknown) => Promise<unknown>;
};

function bridge(): Zero | null {
  const z = (window as unknown as { zero?: Zero }).zero;
  return z && typeof z.invoke === "function" ? z : null;
}

export const hasNativeBridge = (): boolean => bridge() !== null;

/** The host platform, best-effort. Used to tune layout/affordances. */
export function platformName(): "native" | "web" {
  return hasNativeBridge() ? "native" : "web";
}

/**
 * Invoke a native command. The host resolves the parsed `result` directly, so
 * there is nothing to JSON.parse here. Falls back to the provided web
 * implementation when the bridge is unavailable.
 */
export async function invoke<T>(
  command: string,
  payload: unknown,
  webFallback: () => T | Promise<T>,
): Promise<T> {
  const z = bridge();
  if (!z) return webFallback();
  return (await z.invoke(command, payload)) as T;
}

export interface FetchResponse {
  /** HTTP status, or 0 when no bridge/network was available (mock sentinel). */
  status: number;
  contentType: string;
  body: string;
}

const NO_BRIDGE: FetchResponse = { status: 0, contentType: "", body: "" };

/**
 * Fetch a URL through the native `net.fetch` bridge command. The WebView
 * cannot fetch arbitrary origins (CORS/CSP); the Zig shell performs the
 * request and returns the body. In browser dev there is no bridge, so this
 * returns a sentinel (status 0, empty body) and callers fall back to mock —
 * we deliberately do NOT attempt a real cross-origin fetch in the browser.
 */
export async function fetchUrl(url: string): Promise<FetchResponse> {
  try {
    return await invoke<FetchResponse>("net.fetch", { url }, () => NO_BRIDGE);
  } catch {
    return NO_BRIDGE;
  }
}

/**
 * Persist a small blob of state. Keychain-backed natively; localStorage on web.
 * These are best-effort: if the native handler isn't registered yet, they fall
 * back to localStorage rather than throwing, so the app keeps working.
 */
export async function secureSet(key: string, value: string): Promise<void> {
  const web = () => localStorage.setItem(`reader:${key}`, value);
  try {
    await invoke<void>("store.set", { key, value }, web);
  } catch {
    web();
  }
}

export async function secureGet(key: string): Promise<string | null> {
  const web = () => localStorage.getItem(`reader:${key}`);
  try {
    return await invoke<string | null>("store.get", { key }, web);
  } catch {
    return web();
  }
}

export async function secureRemove(key: string): Promise<void> {
  const web = () => localStorage.removeItem(`reader:${key}`);
  try {
    await invoke<void>("store.remove", { key }, web);
  } catch {
    web();
  }
}
