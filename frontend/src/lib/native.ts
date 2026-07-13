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
  invoke: (command: string, payload?: unknown) => Promise<string>;
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
 * Invoke a native command, parsing its JSON reply. Falls back to the provided
 * web implementation when the bridge is unavailable.
 */
export async function invoke<T>(
  command: string,
  payload: unknown,
  webFallback: () => T | Promise<T>,
): Promise<T> {
  const z = bridge();
  if (!z) return webFallback();
  const raw = await z.invoke(command, payload);
  return JSON.parse(raw) as T;
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
