function getWorkspaceTemplate() {
  return `
    <div class="workspace-root flex flex-col h-full w-full bg-black overflow-hidden relative transition-all duration-150">
      
      <div class="ws-header bg-zinc-950/95 border-b border-zinc-800 px-4 py-3 flex items-center justify-between gap-3 z-20 shrink-0">
        <div class="ws-breadcrumbs-strip flex items-center gap-2 overflow-x-auto flex-grow py-0.5 min-w-0">
          <span class="text-zinc-600 font-bold text-sm">Path:</span>
          <span class="text-zinc-500 italic text-sm">No folder</span>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <button class="ws-restore-junk-btn hidden px-4 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-sm rounded-lg transition flex items-center gap-1 shadow">
            ♻ Restore to Origin
          </button>
          
          <button class="ws-select-count-btn hidden px-4 py-1.5 bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white font-black text-sm rounded-full transition flex items-center gap-1 shadow" title="Click to clear selection">
            <span class="ws-select-count-text">0 Selected</span>
            <span class="text-xs opacity-80 ml-1">✕</span>
          </button>

          <input class="ws-tag-sort-input hidden bg-zinc-900 border border-sky-900/80 rounded-lg px-2.5 py-1.5 text-xs text-sky-200 placeholder-zinc-500 w-40 focus:border-sky-400 focus:outline-none font-semibold" placeholder="Sort pane by tag..." title="Float photos matching this tag to the top" />
          
          <button class="ws-undo-btn hidden px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 font-bold rounded-lg text-sm transition flex items-center gap-1.5 shadow" title="Undo last action (Ctrl+Z)">
            <span>↶</span> <span>Undo</span>
          </button>
          
          <button class="ws-inspect-btn px-5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-black text-sky-400 transition flex items-center gap-1">
            <span>🖼</span> <span>Inspect</span>
          </button>
        </div>
      </div>

      <div class="ws-body flex-grow relative overflow-hidden bg-black flex flex-col">
        <div class="ws-grid-container flex-grow overflow-y-auto p-4">
          <div class="ws-grid grid grid-standard gap-4"></div>
        </div>

        <div class="ws-footer-bar bg-zinc-950/90 border-t border-zinc-900 px-4 py-3 flex items-center justify-between gap-4 text-sm text-zinc-400 shrink-0">
          <div class="ws-local-search-wrap hidden items-center gap-2 flex-grow max-w-[240px]">
            <input class="ws-local-search bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-100 w-full focus:border-sky-500 focus:outline-none font-semibold" type="text" placeholder="Filter this pane..." />
          </div>

          <div class="ws-pagination-controls flex items-center gap-3 mx-auto">
            <div class="ws-page-status font-mono text-sm hidden sm:block">Showing 0</div>
            <button class="ws-prev-page px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-lg font-bold disabled:opacity-30">‹ Prev</button>
            <span class="ws-page-indicator font-mono font-bold text-zinc-300 text-sm">1 / 1</span>
            <button class="ws-next-page px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-lg font-bold disabled:opacity-30">Next ›</button>
          </div>

          <div class="flex items-center gap-2 justify-end">
            <select class="ws-local-sort bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer">
              <option value="name_asc">Filename (A-Z)</option>
              <option value="first_tag">First Tag (A-Z)</option>
              <option value="second_tag">Second Tag (A-Z)</option>
              <option value="most_tags">Most Tags First</option>
              <option value="size_desc">File Size (Largest)</option>
            </select>
          </div>
        </div>

        <div class="ws-inspector hidden absolute inset-0 bg-black flex flex-col z-30">
          <div class="ws-viewport flex-grow relative overflow-hidden flex items-center justify-center bg-black">
            <img class="ws-inspected-img max-h-[70vh] max-w-[92vw] object-contain select-none transition-transform duration-75" src="" />
            
            <div class="ws-video-stage hidden max-h-[70vh] max-w-[92vw] w-full h-full relative flex items-center justify-center">
              <video class="ws-inspected-video max-h-[70vh] max-w-[92vw] object-contain cursor-pointer" loop playsinline></video>
            </div>

            <button class="ws-prev-btn absolute left-4 top-1/2 -translate-y-1/2 bg-black/75 hover:bg-zinc-900 text-white px-5 py-10 rounded-xl text-4xl border border-zinc-800 z-10 transition">‹</button>
            <button class="ws-next-btn absolute right-4 top-1/2 -translate-y-1/2 bg-black/75 hover:bg-zinc-900 text-white px-5 py-10 rounded-xl text-4xl border border-zinc-800 z-10 transition">›</button>
          </div>

          <div class="ws-video-controls hidden bg-zinc-950 border-t border-zinc-800 px-6 py-3 flex items-center gap-5 shrink-0 z-20 flex-wrap sm:flex-nowrap">
            <div class="flex items-center gap-2 shrink-0">
              <button class="ws-vid-rewind-btn px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-black rounded-lg transition" title="Rewind 5s">⏪</button>
              <button class="ws-vid-play-btn px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-black rounded-lg transition flex items-center gap-2 shadow" title="Play / Pause">
                <span>▶</span> <span class="ws-vid-play-label">Play</span>
              </button>
              <button class="ws-vid-stop-btn px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-black rounded-lg transition" title="Stop">⏹</button>
              <button class="ws-vid-ff-btn px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-black rounded-lg transition" title="Fast Forward 5s">⏩</button>
            </div>

            <div class="flex items-center border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900 text-xs font-mono font-bold shrink-0" title="Video Playback Speed">
              <button class="ws-rate-05x px-3 py-2 text-zinc-400 hover:text-white transition border-r border-zinc-800">0.5x</button>
              <button class="ws-rate-1x px-3 py-2 bg-rose-600 text-white transition border-r border-zinc-800">1x</button>
              <button class="ws-rate-15x px-3 py-2 text-zinc-400 hover:text-white transition">1.5x</button>
            </div>

            <span class="ws-vid-time font-mono text-sm text-zinc-300 font-bold shrink-0">0:00 / 0:00</span>
            <input class="ws-vid-seek flex-grow h-3 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-500" type="range" min="0" max="100" value="0" step="0.1" />

            <div class="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg shrink-0">
              <button class="ws-vid-mute-btn text-zinc-300 hover:text-white text-base font-bold">🔊</button>
              <input class="ws-vid-volume w-24 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-500" type="range" min="0" max="1" step="0.05" value="1" />
            </div>

            <button class="ws-vid-fullscreen-btn px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-black rounded-lg transition shrink-0">
              ⛶ Fullscreen
            </button>
          </div>

          <div class="h-20 bg-zinc-950 border-t border-zinc-900 px-6 flex items-center justify-center gap-4 shrink-0 z-10">
            <div class="ws-filmstrip-bar flex items-center justify-center gap-3 overflow-x-auto py-2"></div>
          </div>

          <div class="ws-inspector-footer bg-zinc-950/95 border-t border-zinc-800 px-6 py-3 flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <span class="ws-counter font-mono text-xs text-zinc-400 font-bold shrink-0">0 / 0</span>
              <span class="ws-file-name font-mono text-zinc-200 text-sm font-bold truncate max-w-xs"></span>
              <button class="ws-ai-studio-btn px-4 py-2 bg-gradient-to-r from-indigo-900 to-sky-900 hover:from-indigo-800 hover:to-sky-800 border border-sky-500/50 text-sky-200 font-black rounded-lg text-sm transition flex items-center gap-2 shadow-lg shrink-0" title="Toggle Docked Gemini Studio (Ctrl+G)">
                <span>Google Gemini</span> <span class="text-base">✨</span>
              </button>
            </div>
            <div class="ws-item-tags flex flex-wrap gap-2 max-w-lg overflow-x-auto"></div>
            <button class="ws-close-inspector-btn px-5 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-black rounded-lg text-sm transition shadow shrink-0">↩ Return to Grid</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
