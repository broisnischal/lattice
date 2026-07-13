import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/store/auth";
import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/routes/Login";
import { Library } from "@/routes/Library";
import { Reader } from "@/routes/Reader";
import { Feeds } from "@/routes/Feeds";
import { Highlights } from "@/routes/Highlights";
import { Connections } from "@/routes/Connections";
import { Settings } from "@/routes/Settings";
import { AskLibrary } from "@/routes/AskLibrary";
import { Review } from "@/routes/Review";
import { Threads } from "@/routes/Threads";

export default function App() {
  const status = useAuth((s) => s.status);
  const restore = useAuth((s) => s.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-[var(--color-text-faint)]" />
      </div>
    );
  }

  // HashRouter keeps deep links working from the packaged zero:// app origin.
  return (
    <HashRouter>
      {status === "guest" ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Library />} />
            <Route path="/ask" element={<AskLibrary />} />
            <Route path="/review" element={<Review />} />
            <Route path="/threads" element={<Threads />} />
            <Route path="/feeds" element={<Feeds />} />
            <Route path="/highlights" element={<Highlights />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/read/:id" element={<Reader />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </HashRouter>
  );
}
