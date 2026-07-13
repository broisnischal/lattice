import { create } from "zustand";
import { api } from "@/api/mock";
import type { User } from "@/api/types";
import { secureGet, secureRemove, secureSet } from "@/lib/native";

type Status = "loading" | "authed" | "guest";

interface AuthState {
  user: User | null;
  status: Status;
  restore(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  signup(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  async restore() {
    // A real token would be validated with the backend; here we rehydrate the
    // stored session blob from the native keychain / localStorage.
    const blob = await secureGet("session");
    if (blob) {
      try {
        set({ user: JSON.parse(blob) as User, status: "authed" });
        return;
      } catch {
        await secureRemove("session");
      }
    }
    set({ status: "guest" });
  },
  async login(email, password) {
    const user = await api.login(email, password);
    await secureSet("session", JSON.stringify(user));
    set({ user, status: "authed" });
  },
  async signup(name, email, password) {
    const user = await api.signup(name, email, password);
    await secureSet("session", JSON.stringify(user));
    set({ user, status: "authed" });
  },
  async logout() {
    await api.logout();
    await secureRemove("session");
    set({ user: null, status: "guest" });
  },
}));
