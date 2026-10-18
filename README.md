# Photo Tagger & AI Studio

A local, single-binary photo cataloging, rapid-triage utility, and multimodal AI workstation built with Go and embedded Vanilla JS / Tailwind CSS.

The app runs as a lightweight local daemon, automatically launches your browser, and writes non-destructive `catalog.json` sidecar files directly inside your scanned directories. Designed for brutal efficiency, it pairs high-speed media triage with a heavily integrated Google Gemini AI studio for seamless generative editing.

---

### ✨ Flagship Features

**🧠 Gemini AI Workstation (Docked 50/50 Split)**
* **Multi-Reference Group Generation:** Multi-select photos from the grid (e.g., a photo of the bride and a photo of the groom) and feed them simultaneously to Gemini as combined visual references for cohesive group portraits.
* **Zero Disk Pollution:** Generated AI variations are held entirely in volatile RAM via lightweight Blob URLs. Nothing writes to your hard drive until you explicitly click "Save to Folder".
* **Inline Session History:** Scroll through an ephemeral feed of every prompt, generated candidate, and applied style in the current session. Copy prompts, extract AI-suggested tags, or load previous iterations back onto the stage.
* **Color-Coded Style Rack:** Instantly append high-contrast modifiers (Steampunk, Cinematic, Salon, Dynamite) via edge-to-edge hardware-accelerated chips.

**⚖️ Dual Workspace & Inline Comparison**
* **Split-View Architecture:** Open two entirely independent folders side-by-side.
* **Synchronized Pan & Zoom:** Link the tabs to pan and zoom two images across both workspaces simultaneously for pixel-perfect comparison.
* **Tag Drag-Net:** Apply tags, sweep files, or execute bulk AI generations from either active pane without losing your place.

**🛡️ Bulletproof File Operations & Undo Engine**
* **Global Undo (`Ctrl+Z`):** A persistent, path-aware undo buffer. Accidentally moved a batch to `.junk`? Tagged the wrong 50 photos? Hit `Ctrl+Z` to instantly reverse file movements, tag additions, or bulk tag sweeps.
* **Atomic Database Locks:** The Go backend leverages strict `sync.RWMutex` locking and atomic Boolean flags. You can bulk-tag 100 photos, run a background scan, and move files concurrently without race conditions or database corruption.
* **Tag Sweeper:** Instantly relocate all photos sharing a specific tag into a dedicated subfolder with one click.

---

### 📸 Media Engine & Grid Controls

**⚡ High-Speed Triage & Navigation**
* **Native Windows Picker:** Spawns native `CREATE_NO_WINDOW` foreground directory dialogs without flashing background consoles.
* **Dynamic Virtual Grid:** Seamlessly render thousands of photos without choking the browser. Switch instantly between Dense, Standard, and Large viewports.
* **Dual Interaction Modes:** Toggle between **Inspect Mode** (fullscreen lightbox) and **Multi-Select Mode** (batch tagging/moving).
* **Advanced Boolean Filtering:** Conjunction (`AND`) and Exclusion (`-NOT`) search, plus a one-click **Untagged Only** isolation view.

**🎞️ Native Video & Slideshow Deck**
* **Hardware-Accelerated Thumbnails:** Uses Windows Shell APIs with fast in-place BGRA-to-RGBA slice swapping to generate sharp, instant video thumbnails.
* **Full Media Player:** In-lightbox video playback with variable speed controls (0.5x, 1x, 1.5x), volume, seek, and fullscreen toggles.
* **Sequence Playlist (The Deck):** Stage specific photos and videos into a custom playlist. Launch an auto-advancing slideshow with adjustable intervals and shuffle mechanics.

---

### ⌨️ Hotkey Cheat Sheet

*Hotkeys automatically disable while typing in input fields.*

| Key | Context | Action |
| :--- | :--- | :--- |
| **`Ctrl+G`** | Global | Toggle the Docked Gemini AI Studio pane |
| **`Ctrl+Z`** | Global | **Undo** last action (Move, Add Tags, Remove Tags) |
| **`Shift+J`** / **`Del`** | Global / Lightbox | Quick move selected (or currently inspected) to `.junk` |
| **`T`** | Global Grid | Toggle between Multi-Select Mode and Inspect Mode |
| **`Space`** | Slideshow | Play / Pause Slideshow |
| **`F`** | Lightbox (Video) | Toggle Fullscreen Video |
| **`K`** | Lightbox (Video) | Play / Pause Video |
| **`Enter`** | Search/Input | Submit scan, apply custom tag, or send AI Prompt |
| **`→`** / **`←`** | Lightbox | Next / Previous Image or Video |
| **`Escape`** | Modals/Lightbox | Close current modal, studio, or fullscreen viewer |

---

### 🛠️ Architecture & Build

**Project Structure**
```text
tagger/
├── web/
│   ├── index.html         # True 100vh edge-to-edge layout & modal mounts
│   ├── css/app.css        # Pitch-black aesthetic & hardware-accel classes
│   └── js/
│       ├── app.js         # Event bus, global routing, and Undo engine
│       ├── workspace.js   # Dual-pane scoping, DOM rendering, and grid logic
│       ├── gemini.js      # Multi-reference AI API wrapper & Blob URL history
│       ├── api.js         # Folder picking, sweeping, and shutdown
│       ├── deck.js        # Slideshow playlist manager
│       ├── panzoom.js     # Synchronized math for dual-pane zooming
│       ├── presets.js     # Tag palette manager (localStorage)
│       └── state.js       # Global variable bank
├── main.go                # Embeds web/* via embed.FS & launches browser
├── models.go              # Atomic locking, Undo path tracking & sidecar JSON
├── handlers_catalog.go    # Directory browsing, entries, and atomic file moves
├── handlers_gemini.go     # Secure path traversal guards & GenAI API routing
├── handlers_media.go      # Image downscaling, thumbnail serving
└── pathutils.go           # Path translation & silent Windows dialog hooks
Compiling to a Single Windows .exe
Run this inside your WSL or Linux terminal to output a self-contained binary:

Bash
GOOS=windows GOARCH=amd64 go build -ldflags "-H=windowsgui" -o tagger.exe .
The -ldflags "-H=windowsgui" flag compiles the binary as a native GUI application so no black terminal window flashes when launched. All HTML, CSS, and JS assets are compiled directly inside the .exe via embed.FS.

📄 License
Copyright (c) 2026 Phillip Charles. All rights reserved.

This source code and accompanying materials are proprietary and confidential. 
Unauthorized copying, modification, distribution, sublicensing, reverse engineering, 
or commercial use of this software, via any medium, is strictly prohibited without 
the prior express written permission of the copyright holder.

Proprietary / All Rights Reserved. Free for personal evaluation only. Commercial use, distribution, or resale is strictly prohibited.
