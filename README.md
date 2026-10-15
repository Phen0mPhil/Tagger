# Tagger

A high-performance, local-first photo tagging, inspection, and culling workstation application built for Windows. Engineered for rapid triage across large image catalogs with instant in-memory tagging, atomic sidecar persistence, and lockstep dual-pane comparison.

---

## Key Features

- **Standalone Desktop Experience:** Automatically launches in a dedicated, borderless Chrome application window (`--app`) without browser tab clutter or address bars.
- **Unified Workspace Engine:** A single modular workspace architecture powers both full-width single-pane inspection and 50/50 split comparison.
- **Instant In-Memory Tagging:** Tag mutations update in-memory catalog structures and DOM nodes immediately with asynchronous atomic JSON sidecar disk writes.
- **Lockstep Dual Culling (`Sync Tabs`):** Synchronizes focal-point mouse zoom, panning coordinates, and sequential stepping across both panes for critical focus checks, while allowing manual offset via the burst filmstrip.
- **Adjacent Burst Filmstrip:** Displays a 5-thumbnail continuous inspection filmstrip inside the lightbox inspector to streamline continuous high-speed burst selection.
- **Local Triage & Recovery:** Dedicated quarantine routing into folder-resident `.junk` directories, complete with an in-app **Junk Bin** explorer and one-click tag-safe restoration.
- **Native Windows Folder Selection:** Foreground-anchored Win32 folder browser dialog ensures the picker always displays above application windows.
- **Fullscreen Slideshow & Playlist:** Curate custom inspection playlists from grid selections with adjustable playback intervals and randomization.
- **Arbitrary Move & Tag Sweeps:** Move selected assets to existing subfolders, custom subdirectories, or external system paths, with tag-based bulk sweeps.

---

## Tech Stack

- **Backend:** Go (`net/http`, atomic filesystem I/O, Win32 API integration via PowerShell/PInvoke)
- **Frontend:** Vanilla JavaScript (modular component factories), Tailwind CSS, standalone HTML5 Canvas PanZoom engine
- **Data Storage:** Local `catalog.json` sidecar files stored directly alongside media

---

## Getting Started

### Prerequisites

- Go 1.20+
- Google Chrome (optional, for standalone `--app` window mode; defaults to system browser if not present)

### Building the Windows Binary

From WSL or Linux cross-compiling for Windows:
```bash
GOOS=windows GOARCH=amd64 go build -ldflags "-H=windowsgui" -o tagger.exe .
```

---

## Keyboard Controls

| Key | Action |
| :--- | :--- |
| Space | Pause / Resume fullscreen slideshow |
| Arrow Right / Left | Next / Previous photo (syncs across panes when Sync Tabs is active) |
| J | Quick move active photo / selected items to `.junk` |
| T | Toggle Multi-Select mode on/off |
| Esc | Close fullscreen slideshow / inspector |

---

## License

MIT
