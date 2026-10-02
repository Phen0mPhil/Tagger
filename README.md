# Photo Tagger

A high-performance, single-binary photo cataloging, inspection, and rapid-triage workstation built with Go and air-gapped Vanilla JS / Tailwind CSS. 

The application runs as a lightweight local daemon, launches your default browser automatically, and maintains non-destructive `catalog.json` sidecar files directly inside indexed photo directories.

---

## 🌟 What's New in v1.1.0

* **⚖ Standalone Dual-Pane Comparison Sandbox (`compare.html`):** Air-gapped side-by-side photo inspection in an isolated tab. Supports folder quick-hops, synchronized zoom/pan mirroring, instant pane swapping (`⇄ Swap Sides`), and targeted tagging stations (`Pane A`, `Pane B`, or `Both`).
* **🗂 Persistent Cross-Directory Staging Deck:** Stage photos across completely different folders into an persistent sequence queue. Supports intentional duplicate queuing, sequence inspection trays, and live slideshow execution without losing your working grid selection.
* **🔎 Focal-Point Inspection Zoom (`panzoom.js`):** Independent wheel-zoom physics that centers directly on the cursor's focal point (eyes, micro-textures, background details) instead of generic viewport centering.
* **⏱ Full Deck Slideshow Engine:** Variable speed dial (`1s`, `3s`, `5s`, `15s`, `30s`), true Fisher-Yates random shuffle (`🔀`), and on-the-fly live pruning (`Del` / `Evict`) without stopping playback.
* **🛡 Game-Engine Memory Containment:** Dynamic background occlusion (`display: none` on grid) during fullscreen view, downscaled 800px on-the-fly thumbnail caching, and CSS view-frustum DOM pruning (`content-visibility: auto`) to eliminate browser out-of-memory crashes on massive catalogs.

---

## 📁 Core Features

### 🗂 Persistent Deck & Multi-Folder Playlist
* **Independent Staging:** Select photos and click `+ Deck` to queue them without executing immediate slideshows.
* **Cross-Folder Playlists:** Browse between subfolders or entirely separate drives; queued items retain their absolute folder sources.
* **Repetition Support:** Queue photos multiple times to construct custom loops and comparative sequences.
* **Deck Manager Tray:** Click `Deck: X` to open the sequence drawer, inspect miniature thumbnails in order, or evict items.
* **In-Flight Pruning:** Press `Delete` or `Backspace` during a slideshow to evict the active photo from the deck on the fly.

### ⚖ Dual Comparison Sandbox
* **Zero Cross-Talk:** Compare mode runs in an independent browser tab (`/compare.html`) with isolated event loops.
* **Synchronized Transforms:** Toggle `Sync Zoom & Pan` to examine fine focus and depth-of-field differences across two shots simultaneously.
* **One-Click Swap:** Hit `⇄ Swap Sides` (or press `S`) to invert Left/Right panes without resetting zoom state.
* **Split Directory Browsing:** Load different folders or parent/child directories in each pane independently.

### 📁 Smart Directory & Breadcrumb Navigation
* **Native Foreground Folder Picker:** Spawns Windows folder dialogs directly into the OS foreground without command prompt windows (`CREATE_NO_WINDOW`).
* **Interactive Breadcrumbs:** Jump anywhere up directory trees (`D: / Photos / Weddings / 2026`) with one click.
* **Subfolder Quick-Hop Pills:** Clickable child folder buttons to jump into subdirectories without reopening system pickers.
* **Recursive Scoping:** Toggle between flat single-folder scans and deep recursive indexing.

### 🔍 Advanced Boolean Search & Filtering
* **Conjunction (AND):** Search multiple terms (`beach portrait`) to isolate photos matching all terms.
* **Exclusion (NOT):** Prefix terms with `-` (`bikini -sunset`) to exclude unwanted tags or file names.
* **Untagged Quick View (★ Untagged):** Instant toggle to isolate all unclassified photos for rapid triage.
* **Instant Clear (`✕`):** One-click button inside the search bar to reset search filters.

### 🖥 Fast Triage & Grid Controls
* **Dual Interaction Modes:**
  * **Inspect Mode (🔍):** Click any card to launch the fullscreen high-resolution viewer.
  * **Select Mode (☑):** Click anywhere on a photo card to toggle selection for batch tagging.
* **Dynamic Density:** Switch layout size on the fly (`Dense (S)`, `Standard (M)`, `Large (L)`).
* **Chunk Pagination:** Select between 30, 60, 100, or All items per page to keep rendering snappy.
* **Pitch-Black UI (`#000000`):** Pure black interface designed so color grading and skin tones pop with zero ambient light bleed.

---

## ⌨ Hotkey Cheat Sheet

| Key | Context | Action |
| :--- | :--- | :--- |
| **`1` – `9`** | Global Grid / Lightbox | Stamp preset tag in slot 1–9 to active photo or selected batch |
| **`Space`** | Lightbox / Deck | Toggle selection checkmark on currently viewed photo |
| **`→` (Right Arrow)** | Lightbox / Compare | Next image (Pane B in Compare) |
| **`←` (Left Arrow)** | Lightbox / Compare | Previous image (Pane B in Compare) |
| **`A` / `D`** | Compare Tab | Previous / Next image for Pane A |
| **`S`** | Compare Tab | Swap Left and Right panes |
| **`Delete` / `Backspace`** | Slideshow | Evict currently active photo from the Deck sequence |
| **`Escape`** | Lightbox / Modals | Close fullscreen viewer or active manager modal |
| **`T`** | Global Grid | Toggle between Inspect Mode and Select Mode |
| **`Enter`** | Search / Path Input | Submit folder scan or add custom tag |

---

## 🛠 Project Architecture

```text
tagger/
├── web/
│   ├── index.html        # Main workstation UI layout & component mounts
│   ├── compare.html      # Air-gapped dual-pane comparison sandbox
│   ├── css/
│   │   └── app.css       # Pitch-black base styles & view-frustum containment
│   └── js/
│       ├── panzoom.js    # Decoupled focal-point zoom/pan engine instance factory
│       ├── state.js      # Global state, catalog cache & Deck storage engine
│       ├── deck.js       # Staging modal tray controller & sequence management
│       ├── api.js        # REST client for Go server endpoints
│       ├── grid.js       # Filtering, thumbnail pagination & card rendering
│       ├── viewer.js     # Lightbox viewer, speed dial & slideshow pipeline
│       ├── compare.js    # Dual comparison controller & synchronized pan/zoom
│       ├── presets.js    # Tag palette management & modal editor
│       └── app.js        # Global hotkey bus & bootloader
├── handlers.go           # REST API routes (/api/scan, /api/entries, /api/tags, /api/thumbnail)
├── models.go             # Catalog data structures & atomic sidecar JSON updates
├── pathutils.go          # Windows Shell COM folder picker & path normalization
├── scanner.go            # Non-blocking recursive/flat image file discovery
└── main.go               # Static file embedding (embed.FS), HTTP daemon & browser launch
