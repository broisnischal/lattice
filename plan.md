# Reader — Implementation Plan & Changelog

An AI-first, cross-platform reading app (Apple Books–class, dark/monochrome craft).
Read anything — EPUB, PDF, text/Markdown, web articles, RSS — turned into one clean
reading surface, with an AI copilot, highlights, spaced repetition, and concept threads.

- **Shell:** Native SDK (`@native-sdk/cli`, Zig 0.16) — WebView-shell architecture.
- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 + zustand + react-router (HashRouter) + lucide-react.
- **Location:** `/home/nees/reader` (frontend in `frontend/`).
- **Targets:** desktop-first (macOS/Linux/Windows); mobile is experimental in the SDK — UI kept as a portable web frontend so it can drop into a mobile host later.
- **Backend:** mocked (`frontend/src/api/mock.ts`) behind a stable seam; swap for a real API later.

---

## 1. Design system (NON-NEGOTIABLE craft bar)

Reference: Conduish-dark / Apple / Emil Kowalski. **Fully monochrome — no color in chrome.**

- True-black canvas (`--color-bg #0a0a0b`); surfaces barely lifted (`#161618`/`#1c1c1f`).
- **Hairline borders** only (white @ 6–11% alpha), never hard lines.
- **Icon tiles are neutral graphite squircles** — no gradients, no hue. Identity comes from
  the format glyph + typography. (`IconTile`/`Tile` rewritten to drop the `gradient` prop.)
- Decorative signals (progress rings, badges, unread dots, active states) → **white/grey**
  via `--color-signal` / `--color-ring-track`. The blue `--color-accent` is retained as a
  token but NOT used in chrome.
- User highlight markers are the only permitted hue, kept low-saturation (`--hl-*`).
- Motion: every interactive element springs on `:active` via `--ease-spring:
  cubic-bezier(.32,.72,0,1)`; enter animations via `--ease-out`.
- Layout: `TopBar` (drag region, 64px macOS traffic-light inset, app pill + workspace + avatar)
  over `Sidebar` (224px: Library / Feeds / Highlights · Intelligence: Ask · Review · Threads ·
  Connect / Settings, + mono `v0.1.0` footer) | hairline | content.
- **Rejected looks (do not reintroduce):** purple/blue-tinted palettes, gradient callout
  boxes, colored primary buttons, emoji-as-icons. Those read as "vibecoded".

Tokens live in `frontend/src/index.css` `@theme`; legacy var names aliased in `:root`.

---

## 2. Fixes

### 2a. EPUB / PDF import (was rendering garbage bytes)
Root cause: `ImportDialog.onFile()` called `file.text()` on binary files (EPUB is a ZIP,
PDF is binary) and split raw bytes into paragraphs → mojibake.

- **EPUB:** `jszip` → read `META-INF/container.xml` → OPF → spine order → parse each XHTML
  doc with `DOMParser` into normalized `Block[]` (h1/h2/h3/p/quote), preserving reading order;
  pull title/author/cover from OPF metadata.
- **PDF:** `pdfjs-dist` → load ArrayBuffer, iterate pages, extract text items into paragraph
  blocks (worker URL bundled via Vite `?url`).
- **TXT:** `file.text()` (real text). **Markdown:** minimal MD→blocks parse.
- Read binaries as `ArrayBuffer` (never `file.text()` on epub/pdf).
- ImportDialog shows an **extraction preview** before adding; parse failures show a friendly
  error instead of injecting garbage.

### 2b. Web import + RSS (were mocked / non-functional)
Root cause: a WebView can't `fetch()` cross-origin (CORS/CSP).

- **Native HTTP bridge:** Zig `net.fetch` command in `src/main.zig` (+ `app.zon` bridge policy
  and allowed origins) fetches URL/feed bytes and returns `{status, contentType, body}`.
- `frontend/src/lib/native.ts` adds `fetchUrl(url)` via the `invoke` wrapper, with a
  **browser-dev fallback** (mock) so `npm run dev` still works without the native shell.
- Web article → Readability-style extraction → clean blocks. RSS/Atom → `DOMParser` of feed
  XML → real items (title/link/date/content). Both degrade to mock when offline/no bridge.

---

## 3. Performance & memory (the "lightning-fast" pass)

Root cause of slowness: whole book rendered to the DOM at once + full book bodies kept in
React state and `localStorage` (synchronous, ~5MB cap).

1. **Virtualize the reading surface** — render only blocks near the viewport
   (`@tanstack/react-virtual` or IntersectionObserver) + CSS `content-visibility: auto` /
   `contain-intrinsic-size`. DOM node count stays ~constant regardless of book length →
   flat memory, 60fps scroll. Scroll-progress + position restore preserved.
2. **IndexedDB for content** (`idb`): book `blocks` and highlights live in IndexedDB, NOT
   localStorage/zustand. Store keeps only light metadata (id/title/author/format/progress/
   cover/wordCount). Content loads lazily on Reader open, released on unmount.
3. **Web Worker parsing:** jszip/pdfjs extraction runs off the main thread; progress shown in
   the ImportDialog; blocks streamed/chunked for very large books.
4. **Precompute highlight ranges** per block once (memoized), not per render.
5. **Chapterize EPUB** by spine; lazy-load the current chapter.

Acceptance: a 6,000-block book opens instantly with 60fps scroll and flat memory (verified
with a synthetic large-book seed).

---

## 4. Differentiating features (what other readers don't do)

1. **Ask your library (with citations)** — `/ask`, palette-style. Searches across ALL books'
   blocks and returns an answer with citation chips deep-linking to `/read/:id?block=N`
   (scrolls to + flashes the source passage).
2. **Highlights → spaced repetition** — `/review`. Highlights become review cards with an
   SM-2-style scheduler (`due`/`ease`/`interval`, persisted); due count shown in the sidebar;
   flip-card grade (Again/Good/Easy) reschedules.
3. **Concept threads** — `/threads`. Clusters highlights/passages across books into topical
   threads (keyword/tag clustering), each linking back to sources.
4. **Convert anything → clean book** — the import pipeline (2a/2b) with preview is the moat:
   web/PDF/EPUB/Notion → beautifully structured reading.

Identity wedge: **"read anything, ask everything."**

---

## 5. File map (key)

```
app.zon                         # manifest: identity, window, bridge policy (+ net.fetch)
build.zig                       # pins exe.use_llvm/use_lld on Linux (.sframe linker fix)
src/main.zig                    # App, bridge handlers (store.*, net.fetch)
frontend/src/
  index.css                     # monochrome design system (@theme tokens)
  api/{types,mock}.ts           # domain types + mock backend seam
  lib/{native,format,highlight,cn}.ts
  store/{auth,library,settings,review}.ts
  db/…                          # IndexedDB (idb) content + highlights store
  workers/parser.worker.ts      # EPUB/PDF parsing off-thread
  components/{IconTile,Tile,ImportDialog}.tsx
  components/layout/{TopBar,Sidebar,AppShell}.tsx
  components/library/{BookRow,GroupCard}.tsx
  components/reader/{AiPanel,TypographyControls}.tsx
  routes/{Login,Library,Reader,Feeds,Highlights,Ask,Review,Threads,Connections,Settings}.tsx
```

---

## 6. Build, run, verify

```bash
# Frontend
cd frontend && npx tsc --noEmit && npm run build

# Native desktop window (from repo root)
cd /home/nees/reader && zig build run     # production dist
cd /home/nees/reader && zig build dev      # Vite HMR inside the native shell
zig build                                  # compile native binary only
```

Env: needs system `webkitgtk-6.0`. Zig 0.16; `build.zig` already pins LLVM+LLD on Linux.

**Visual verification:** SDK automation can't screenshot WebView pixels. Use Playwright
against the Vite dev server (chromium cached at `~/.cache/ms-playwright`); seed
`localStorage["reader:session"]` to bypass the login gate; viewport 1240×820. Iterate
screenshot → refine until monochrome + polished.

---

## 6b. Mobile (iOS + Android) via Capacitor

Desktop stays on the Native SDK shell. Mobile ships the **same** `frontend/dist`
wrapped by **Capacitor 8** — no UI rewrite (HashRouter → loads bundled dist, works
offline, identical to desktop WebView).

- **Deps** (`frontend/`): `@capacitor/core`, `@capacitor/preferences`,
  `@capacitor/filesystem`, `@capacitor/android`, `@capacitor/ios` + dev `@capacitor/cli`.
- **Config:** `frontend/capacitor.config.json` — `appId app.reader.mobile`,
  `appName Reader`, `webDir dist`, `server.androidScheme https`. NOTE: a `.ts`
  config is **not viable** here — the repo pins `typescript@7` (the Go native
  preview), whose JS module exposes no compiler API (`ts.transpileModule` is
  undefined), so the Capacitor CLI can't transpile a `.ts` config. JSON is read
  with zero TypeScript dependency and works locally + in CI.
- **Native projects** (committed): `frontend/android` (Gradle) and `frontend/ios`
  (Xcode, **Swift Package Manager** — `App.xcodeproj`, no standalone
  `.xcworkspace`; scheme `App`). Both created on Linux (`cap add ios` works
  because Cap 8 uses SPM, not CocoaPods → no `pod install`/macOS needed to scaffold).
- **npm scripts:** `cap:sync` / `cap:android` / `cap:ios` = `vite build && cap sync[…]`.
- **Three-way runtime** (`frontend/src/lib/native.ts`): desktop `window.zero`
  bridge → **Capacitor** (`Capacitor.isNativePlatform()`) → plain web. On
  Capacitor, `fetchUrl` uses **CapacitorHttp** (no WebView CORS, so web import +
  RSS work) and `secure{Set,Get,Remove}` use **@capacitor/preferences**. Desktop
  (`net.fetch` + keychain `store.*`) and web (mock + localStorage) branches are
  unchanged.
- **CI:** `.github/workflows/mobile.yml` (additive; desktop `release.yml`
  untouched). Triggers on `v*` tags + manual dispatch.
  - **android** (ubuntu): node 20 + JDK 17 + `setup-android` → build web → `cap
    sync android` → `gradlew assembleDebug` → always ship `reader-android.apk`.
    If `ANDROID_KEYSTORE_BASE64` secret present → also `assembleRelease
    bundleRelease` (signed via guarded `signingConfig` in `app/build.gradle`,
    fed by `-PRELEASE_*` props) → `reader-android-release.apk` + `reader-android.aab`.
  - **ios** (macos): build web → `cap sync ios` → `xcodebuild -project
    …/App.xcodeproj -scheme App -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO` →
    zip `.app` → `reader-ios-simulator.zip` (unsigned, no Apple cert). Device
    `.ipa` steps are commented (need Apple signing secrets); workflow never fails
    on missing iOS signing.

**Signing secrets needed for STORE builds:**
- Android (Play): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- iOS (App Store / device): `APPLE_CERTIFICATE_BASE64`, `APPLE_CERTIFICATE_PASSWORD`,
  `APPLE_PROVISIONING_PROFILE`, `APPLE_TEAM_ID`.

**Must run on macOS:** the actual iOS `xcodebuild` (simulator or device) and any
signed `.ipa`. Everything else (scaffolding, `cap sync`, tsc, web build, Android
APK) runs on Linux/CI.

---

## 7. Status

- [x] Native SDK shell builds & launches on Linux (bridge round-trip confirmed).
- [x] Design system v1 (Conduish-grade) → v2 **monochrome** pass.
- [ ] EPUB/PDF real parsing (web worker) — in progress.
- [ ] Web import + RSS via native `net.fetch` bridge — in progress.
- [ ] IndexedDB content store + reader virtualization — in progress.
- [ ] Features 1–4 (Ask / Review / Threads / Convert preview) — in progress.

_Backend, real AI (Claude API via bridge), Notion OAuth, and cloud sync remain mocked with
clean seams for later._
