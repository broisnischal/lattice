import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useLibrary } from "@/store/library";

export function AppShell() {
  const loadAll = useLibrary((s) => s.loadAll);
  const loaded = useLibrary((s) => s.loaded);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loaded) loadAll();
  }, [loaded, loadAll]);

  // Cmd/Ctrl+J opens the library-wide "Ask" palette from anywhere in the shell.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        navigate("/ask");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-bg)]">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="w-px shrink-0 bg-[var(--color-hairline)]" />
        <main className="min-w-0 flex-1 overflow-hidden bg-[var(--color-bg)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
