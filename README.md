# Tagger 🏷️⚡

A high-performance, local-first photo and video cataloging desktop workstation built with a native Go backend and a low-latency web UI embedded via `//go:embed`.

Designed to handle large multi-gigabyte media collections without external database engines, cloud lock-in, or telemetry.

---

## Key Features

- **Blazing Fast Local Metadata:** Direct catalog read/writes stored in discreet `.tagger/` metadata manifests alongside your folders.
- **Native Win32 COM Video Thumbnails:** Zero PowerShell subprocess spam. Utilizes in-process Windows Shell COM APIs (`IShellItemImageFactory`) via `shell32.dll` and `gdi32.dll` locked to single-threaded apartments (`runtime.LockOSThread()`) for near-instant video thumbnail rendering.
- **Dedicated Media Transport Deck:**
  - High-precision video inspection with Stop (`⏹`), Rewind (`⏪`), Play/Pause (`▶`/`⏸`), and Fast Forward (`⏩`).
  - Configurable skip intervals: **1s**, **5s**, and **10s** step toggles.
  - Dedicated hardware volume track and mute toggles.
  - Fullscreen video support via the HTML5 Fullscreen API (`⛶ Fullscreen` button, double-click, or `F` hotkey).
- **Dual-Pane Split Compare Mode:**
  - Independent side-by-side workspace panes (Pane A and Pane B).
  - Synchronized PanZoom engine with decoupled transforms and independent wheel-event guards.
  - Directional tag routing and per-pane breadcrumb navigation.
- **Slideshow & Deck Engine:**
  - Integrated slideshow playlist with automatic shuffle, custom speed intervals, and mixed photo/video playback.
  - Intelligent video pause-and-advance detection (`onended` routing).
- **Safe Relocation & Junk Bin:**
  - Move files across folders or straight into local `.junk` quarantine subfolders.
  - In-place restore to original directory roots.
  - Internal collision resolution and destination cache synchronization (`globalPool` invalidation).
- **Embedded Lightweight Single-Binary Distribution:** Zero external assets to ship. All HTML, CSS, and JS components compile directly into the final standalone Windows binary.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Space`** / **`K`** | Play / Pause inspected video or slideshow |
| **`F`** | Toggle video fullscreen |
| **`ArrowLeft`** / **`ArrowRight`** | Next / previous photo (or skip video by active interval) |
| **`J`** / **`L`** | Step backward / forward in inspected video |
| **`Shift + J`** or **`Delete`** | Immediately move active inspected media or selection to `.junk` |
| **`Escape`** | Close slideshow modal or return from inspector back to grid |
| **`T`** | Toggle multi-select mode |

---

## Architecture & Tech Stack

```text
Tagger/
├── main.go               # Application entrypoint & HTTP router
├── handlers.go           # REST API endpoints (scan, browse, move, tag, thumbnail)
├── models.go             # Catalog data models, pool cache, and file moving engine
├── pathutils.go          # Cross-platform and Win32 root-drive path normalizer
├── thumb_windows.go      # Native Win32 COM Shell thumbnail extraction engine
├── thumb_unix.go         # Unix fallback stub
└── web/                  # Embedded frontend UI (Vanilla JS, Tailwind CSS, PanZoom)
    ├── index.html        # App layout and modals
    ├── css/app.css       # Custom styles
    └── js/
        ├── app.js        # Core conductor, global bindings, keyboard transport
        ├── api.js        # Backend fetch wrappers
        ├── workspace.js  # Dual workspace mounting, media deck, grid renderer
        ├── viewer.js     # Slideshow engine with video playback
        ├── panzoom.js    # Transform controller with event isolation
        └── tagdock.js    # Interactive tag selector
Building from Source
Prerequisites
Go 1.22+

Windows 10/11 or WSL (Windows Subsystem for Linux) with cross-compilation target.

Build (Cross-compile to Windows from WSL)
Bash
GOOS=windows GOARCH=amd64 go build -ldflags "-H=windowsgui" -o tagger.exe .
Note: The -ldflags "-H=windowsgui" flag strips the console window so the application launches cleanly as a standard Windows desktop application.

License
MIT License. Free to use, modify, and distribute.
