let primaryWorkspace = null;
let secondaryWorkspace = null;
let isSplitMode = false;
let activeWorkspaceId = "A";
let knownMoveSubfolders = new Set();
const SESSION_CLIENT_ID = "client_" + Math.random().toString(36).substring(2) + "_" + Date.now();

const REST_BTN_CLASSES = {
  modeToggleBtn: "px-4 py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 rounded-lg text-sm font-black transition flex items-center gap-2 shrink-0 whitespace-nowrap",
  inlineCompareToggleBtn: "px-3 py-2 bg-violet-950 hover:bg-violet-900 border border-violet-700 text-violet-200 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow shrink-0 whitespace-nowrap",
  hubBtnSlideshow: "px-3.5 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 rounded-lg text-sm font-black flex items-center gap-2 transition shrink-0 whitespace-nowrap",
  hubBtnTags: "px-3.5 py-2 bg-yellow-950 hover:bg-yellow-900 border border-yellow-700 text-yellow-200 rounded-lg text-sm font-black flex items-center gap-2 transition shrink-0 whitespace-nowrap",
  untaggedToggleBtn: "px-3 py-2 bg-lime-950 hover:bg-lime-900 text-lime-200 border border-lime-700 rounded-lg text-xs font-black transition shrink-0 whitespace-nowrap"
};

const ACTIVE_RED_CLASS_LG = "px-4 py-2 bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white rounded-lg text-sm font-black transition flex items-center gap-2 shrink-0 shadow-lg shadow-rose-600/40 whitespace-nowrap";
const ACTIVE_RED_CLASS_MD = "px-3.5 py-2 bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white rounded-lg text-sm font-black flex items-center gap-2 transition shrink-0 shadow-lg shadow-rose-600/40 whitespace-nowrap";
const ACTIVE_RED_CLASS_SM = "px-3 py-2 bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-rose-600/40 shrink-0 whitespace-nowrap";

window.getActiveWorkspace = function() {
  if (activeWorkspaceId === "B" && isSplitMode && secondaryWorkspace) {
    return secondaryWorkspace;
  }
  return primaryWorkspace || window.primaryWorkspace || null;
};

window.onSyncStep = (sourceId, delta) => {
  const check = document.getElementById("syncZoomCheck");
  if (!check || !check.checked || !isSplitMode) return;

  if (sourceId === "A" && secondaryWorkspace) {
    secondaryWorkspace.navigate(delta, true);
  } else if (sourceId === "B" && primaryWorkspace) {
    primaryWorkspace.navigate(delta, true);
  }
};

window.removeSpecificTag = (wsId, relPath, tag) => {
  if (wsId === "A" && primaryWorkspace) {
    primaryWorkspace.removeSpecificTag(relPath, tag);
  } else if (wsId === "B" && secondaryWorkspace) {
    secondaryWorkspace.removeSpecificTag(relPath, tag);
  }
};

function sendHeartbeat() {
  fetch(`/api/heartbeat?id=${encodeURIComponent(SESSION_CLIENT_ID)}`, {
    method: "POST",
    keepalive: true
  }).catch(() => {});
}

window.addEventListener("pagehide", () => {
  if (navigator.sendBeacon) {
    navigator.sendBeacon(`/api/client-close?id=${encodeURIComponent(SESSION_CLIENT_ID)}`);
  } else {
    fetch(`/api/client-close?id=${encodeURIComponent(SESSION_CLIENT_ID)}`, { method: "POST", keepalive: true }).catch(() => {});
  }
});

async function initApp() {
  sendHeartbeat();
  setInterval(sendHeartbeat, 3000);

  window.mainTagDock = createTagDock({
    containerEl: document.getElementById("palettePills"),
    onTagSelected: async (tag) => {
      const selA = primaryWorkspace ? primaryWorkspace.getSelected() : [];
      const selB = (isSplitMode && secondaryWorkspace) ? secondaryWorkspace.getSelected() : [];

      if (selA.length > 0 || selB.length > 0) {
        if (selA.length > 0) await primaryWorkspace.applyTags([tag]);
        if (selB.length > 0) await secondaryWorkspace.applyTags([tag]);
        return;
      }

      const activeWs = window.getActiveWorkspace();
      if (activeWs) {
        await activeWs.applyTags([tag]);
      }
    },
    onTagRemoved: async (tag) => {
      await removeTagFromActive(tag);
    }
  });

  primaryWorkspace = createWorkspace({
    id: "A",
    containerEl: document.getElementById("primaryWorkspaceMount"),
    onFocusChange: () => setFocusedWorkspace("A")
  });
  window.primaryWorkspace = primaryWorkspace;

  secondaryWorkspace = createWorkspace({
    id: "B",
    containerEl: document.getElementById("secondaryWorkspaceMount"),
    onFocusChange: () => setFocusedWorkspace("B")
  });
  window.secondaryWorkspace = secondaryWorkspace;

  if (primaryWorkspace.panZoom && secondaryWorkspace.panZoom) {
    primaryWorkspace.panZoom.onSync((s, x, y) => {
      const check = document.getElementById("syncZoomCheck");
      if (check && check.checked && secondaryWorkspace.panZoom) {
        secondaryWorkspace.panZoom.setTransform(s, x, y);
      }
    });

    secondaryWorkspace.panZoom.onSync((s, x, y) => {
      const check = document.getElementById("syncZoomCheck");
      if (check && check.checked && primaryWorkspace.panZoom) {
        primaryWorkspace.panZoom.setTransform(s, x, y);
      }
    });
  }

  setFocusedWorkspace("A");

  const params = new URLSearchParams(window.location.search);
  const initialDir = params.get("dir") || "";
  if (initialDir) {
    if (typeof currentDir !== "undefined") currentDir = initialDir;
    await primaryWorkspace.setDirectory(initialDir);
  }

  if (typeof renderPresetSelector === "function") renderPresetSelector();
  if (typeof updateDeckUI === "function") updateDeckUI();
}

function setFocusedWorkspace(id) {
  activeWorkspaceId = id;
  if (primaryWorkspace) primaryWorkspace.setActiveHighlight(id === "A");
  if (secondaryWorkspace) secondaryWorkspace.setActiveHighlight(id === "B" && isSplitMode);
}

function toggleSplitView() {
  isSplitMode = !isSplitMode;
  const stage = document.getElementById("mainWorkspaceStage");
  const secondaryMount = document.getElementById("secondaryWorkspaceMount");
  const splitControls = document.getElementById("splitDockControls");
  const btn = document.getElementById("inlineCompareToggleBtn");

  if (typeof isGeminiStudioOpen !== "undefined" && isGeminiStudioOpen) {
    if (typeof closeGeminiModal === "function") closeGeminiModal();
  }

  if (isSplitMode) {
    stage.classList.remove("grid-cols-1");
    stage.classList.add("grid-cols-2");
    secondaryMount.classList.remove("hidden");
    if (splitControls) splitControls.classList.remove("hidden");
    btn.className = ACTIVE_RED_CLASS_SM;

    if (!secondaryWorkspace.getDirectory() && primaryWorkspace.getDirectory()) {
      secondaryWorkspace.setDirectory(primaryWorkspace.getDirectory());
    }
    setFocusedWorkspace(activeWorkspaceId);
    primaryWorkspace.toggleSplitModeUI(true);
    secondaryWorkspace.toggleSplitModeUI(true);
  } else {
    stage.classList.remove("grid-cols-2");
    stage.classList.add("grid-cols-1");
    secondaryMount.classList.add("hidden");
    if (splitControls) splitControls.classList.add("hidden");
    btn.className = REST_BTN_CLASSES.inlineCompareToggleBtn;
    setFocusedWorkspace("A");
    primaryWorkspace.toggleSplitModeUI(false);
    secondaryWorkspace.toggleSplitModeUI(false);
  }
}

async function swapSplitWorkspaces() {
  if (!isSplitMode || !secondaryWorkspace) return;
  const dirA = primaryWorkspace.getDirectory();
  const dirB = secondaryWorkspace.getDirectory();
  const stateA = primaryWorkspace.getState();
  const stateB = secondaryWorkspace.getState();

  await primaryWorkspace.setDirectory(dirB, stateB);
  await secondaryWorkspace.setDirectory(dirA, stateA);
}

function toggleMenuDrawer(name) {
  const drawers = { slideshow: document.getElementById("drawerSlideshow"), tags: document.getElementById("drawerTags") };
  const buttons = { slideshow: document.getElementById("hubBtnSlideshow"), tags: document.getElementById("hubBtnTags") };

  if (!drawers[name]) return;
  const isCurrentlyOpen = !drawers[name].classList.contains("hidden");

  Object.values(drawers).forEach(d => { if (d) d.classList.add("hidden"); });
  if (buttons.slideshow) buttons.slideshow.className = REST_BTN_CLASSES.hubBtnSlideshow;
  if (buttons.tags) buttons.tags.className = REST_BTN_CLASSES.hubBtnTags;

  if (!isCurrentlyOpen) {
    drawers[name].classList.remove("hidden");
    if (buttons[name]) buttons[name].className = ACTIVE_RED_CLASS_MD;
    if (name === "tags" && window.mainTagDock) {
      const ws = window.getActiveWorkspace();
      const current = (ws && ws.getState().isInspectMode) ? ws.getCurrentItem() : null;
      window.mainTagDock.render(current ? (current.tags || []) : []);
    }
  }
}

function closeAllDrawers() {
  ["drawerSlideshow", "drawerTags"].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add("hidden"); });
  const sBtn = document.getElementById("hubBtnSlideshow");
  const tBtn = document.getElementById("hubBtnTags");
  if (sBtn) sBtn.className = REST_BTN_CLASSES.hubBtnSlideshow;
  if (tBtn) tBtn.className = REST_BTN_CLASSES.hubBtnTags;
}

function toggleInteractionMode() {
  if (typeof isSelectMode !== "undefined") isSelectMode = !isSelectMode;
  const btn = document.getElementById("modeToggleBtn");
  if (typeof isSelectMode !== "undefined" && isSelectMode) {
    btn.className = ACTIVE_RED_CLASS_LG;
    btn.innerHTML = `<span id="modeIcon">☑</span> <span id="modeLabel">Multi-Select: On</span>`;
  } else {
    btn.className = REST_BTN_CLASSES.modeToggleBtn;
    btn.innerHTML = `<span id="modeIcon">☑</span> <span id="modeLabel">Multi-Select: Off</span>`;
  }
}

function selectVisible() { 
  const ws = window.getActiveWorkspace();
  if (ws) ws.selectAll(); 
}

function clearSelection() { 
  if (primaryWorkspace) primaryWorkspace.clearSelection();
  if (isSplitMode && secondaryWorkspace) secondaryWorkspace.clearSelection();
}

function addToDeckFromSelection() {
  const workspaces = [primaryWorkspace];
  if (isSplitMode && secondaryWorkspace) {
    workspaces.push(secondaryWorkspace);
  }

  let totalAdded = 0;

  workspaces.forEach(ws => {
    if (!ws) return;
    const selectedPaths = ws.getSelected();
    const entries = ws.getEntries();
    const activeDir = ws.getDirectory();

    selectedPaths.forEach(rel => {
      const item = entries.find(e => e.relative_path === rel);
      if (item && typeof deck !== "undefined") {
        deck.push({ dir: activeDir, relative_path: item.relative_path, file_name: item.file_name });
        totalAdded++;
      }
    });

    ws.clearSelection();
  });

  if (totalAdded === 0) {
    if (typeof showToast === "function") showToast("Select photos first to add to Playlist");
    return;
  }

  if (typeof saveDeck === "function") saveDeck();
  if (typeof showToast === "function" && typeof deck !== "undefined") showToast(`Added ${totalAdded} items to Playlist (Total: ${deck.length})`);
}

function setDensity(mode) {
  const db = document.getElementById("denseBtn");
  const sb = document.getElementById("stdBtn");
  const lb = document.getElementById("largeBtn");
  
  if (db) db.className = mode === 'dense' ? "px-3 py-2 text-xs bg-rose-600 text-white border-r border-zinc-800 font-black flex-1" : "px-3 py-2 text-xs bg-zinc-900 text-zinc-300 border-r border-zinc-800 font-bold flex-1";
  if (sb) sb.className = mode === 'standard' ? "px-3 py-2 text-xs bg-rose-600 text-white border-r border-zinc-800 font-black flex-1" : "px-3 py-2 text-xs bg-zinc-900 text-zinc-300 border-r border-zinc-800 font-bold flex-1";
  if (lb) lb.className = mode === 'large' ? "px-3 py-2 text-xs bg-rose-600 text-white font-black flex-1" : "px-3 py-2 text-xs bg-zinc-900 text-zinc-300 font-bold flex-1";

  if (primaryWorkspace) primaryWorkspace.setGridDensity(mode);
  if (secondaryWorkspace) secondaryWorkspace.setGridDensity(mode);
}

function changeSortMode(val) {
  if (primaryWorkspace) primaryWorkspace.setSort(val);
  if (secondaryWorkspace) secondaryWorkspace.setSort(val);
}

function changePageSize(val) {
  if (typeof pageSize !== "undefined") pageSize = parseInt(val, 10);
  const label = document.getElementById("viewingLabel");
  if (label && typeof pageSize !== "undefined") { label.textContent = pageSize >= 99999 ? "Viewing (All)" : `Viewing (${pageSize})`; }
  if (primaryWorkspace) primaryWorkspace.renderGrid();
  if (secondaryWorkspace) secondaryWorkspace.renderGrid();
}

async function rescanWorkspaces() {
  if (primaryWorkspace && primaryWorkspace.getDirectory()) {
    await primaryWorkspace.setDirectory(primaryWorkspace.getDirectory(), primaryWorkspace.getState());
  }
  if (isSplitMode && secondaryWorkspace && secondaryWorkspace.getDirectory()) {
    await secondaryWorkspace.setDirectory(secondaryWorkspace.getDirectory(), secondaryWorkspace.getState());
  }
}

function applyFilters() {
  if (primaryWorkspace) primaryWorkspace.applyFilters();
  if (secondaryWorkspace) secondaryWorkspace.applyFilters();
}

function clearSearch() { const s = document.getElementById("searchInput"); if (s) { s.value = ""; applyFilters(); } }
function clearExclude() { const e = document.getElementById("excludeInput"); if (e) { e.value = ""; applyFilters(); } }

function toggleUntaggedOnly() {
  if (typeof untaggedOnly !== "undefined") untaggedOnly = !untaggedOnly;
  const btn = document.getElementById("untaggedToggleBtn");
  if (btn && typeof untaggedOnly !== "undefined") btn.className = untaggedOnly ? ACTIVE_RED_CLASS_SM : REST_BTN_CLASSES.untaggedToggleBtn;
  applyFilters();
}

async function removeTagFromActive(tag) { 
  const ws = window.getActiveWorkspace();
  if (ws) await ws.removeTag(tag); 
}

async function applyCustomTagInput() {
  const input = document.getElementById("customTagInput");
  if (!input) return;
  const val = input.value.trim().toLowerCase();
  if (!val) return;
  const tags = val.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);

  const selA = primaryWorkspace ? primaryWorkspace.getSelected() : [];
  const selB = (isSplitMode && secondaryWorkspace) ? secondaryWorkspace.getSelected() : [];

  if (selA.length > 0) await primaryWorkspace.applyTags(tags);
  if (selB.length > 0) await secondaryWorkspace.applyTags(tags);
  if (selA.length === 0 && selB.length === 0) {
    const ws = window.getActiveWorkspace();
    if (ws) await ws.applyTags(tags);
  }
  input.value = "";
}

async function openJunkBin() {
  const ws = window.getActiveWorkspace();
  if (!ws) return;
  const current = ws.getDirectory();
  if (!current) {
    if (typeof showToast === "function") showToast("Select a directory first");
    return;
  }
  const junkPath = current.endsWith(".junk") ? current : `${current}/.junk`;
  await ws.setDirectory(junkPath);
  if (typeof showToast === "function") showToast("Viewing Junk Bin. Select items and click 'Restore to Origin' to recover.");
}

function updateMoveFolderStatus() {
  const input = document.getElementById("moveDestInput");
  const statusEl = document.getElementById("moveFolderStatus");
  if (!input || !statusEl) return;

  const val = (input.value || "").trim();
  if (!val) {
    statusEl.textContent = "";
    return;
  }

  if (val.includes(":") || val.startsWith("/")) {
    statusEl.className = "text-[11px] font-mono font-bold text-sky-400";
    statusEl.textContent = "📂 Custom Path (Creates if needed)";
  } else if (knownMoveSubfolders.has(val.toLowerCase())) {
    statusEl.className = "text-[11px] font-mono font-bold text-emerald-400";
    statusEl.textContent = "✓ Folder exists";
  } else {
    statusEl.className = "text-[11px] font-mono font-bold text-amber-400";
    statusEl.textContent = "✨ Will create new folder";
  }
}

async function openMoveModal() {
  const modal = document.getElementById("moveModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  const input = document.getElementById("moveDestInput");
  const sweepInput = document.getElementById("sweepTagInput");
  if (input) { input.value = ""; input.focus(); }
  if (sweepInput) { sweepInput.value = ""; }

  knownMoveSubfolders.clear();
  updateMoveFolderStatus();

  const container = document.getElementById("moveExistingFolders");
  if (container) {
    container.innerHTML = `<span class="text-xs text-zinc-600 font-mono italic">Loading folders...</span>`;
    const ws = window.getActiveWorkspace();
    if (!ws || !ws.getDirectory()) {
      container.innerHTML = `<span class="text-xs text-zinc-600 font-mono italic">No active folder loaded</span>`;
      return;
    }
    const activeDir = ws.getDirectory();
    try {
      const res = await fetch(`/api/browse?dir=${encodeURIComponent(activeDir)}`);
      if (res.ok) {
        const data = await res.json();
        const subs = data.subfolders || [];
        container.innerHTML = "";
        if (subs.length === 0) {
          container.innerHTML = `<span class="text-xs text-zinc-600 font-mono italic">No existing subfolders yet — type a name above to create one</span>`;
        } else {
          subs.forEach(sub => {
            knownMoveSubfolders.add(sub.name.toLowerCase());
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "px-3 py-1 bg-zinc-900 hover:bg-amber-950/80 border border-zinc-700 hover:border-amber-600 text-zinc-200 hover:text-amber-300 rounded-md text-xs font-mono transition";
            btn.textContent = `📁 ${sub.name}`;
            btn.onclick = () => {
              if (input) {
                input.value = sub.name;
                updateMoveFolderStatus();
                input.focus();
              }
            };
            container.appendChild(btn);
          });
        }
      }
    } catch (e) {
      container.innerHTML = `<span class="text-xs text-rose-400 font-mono">Failed loading subfolders</span>`;
    }
  }
}

function closeMoveModal() {
  const modal = document.getElementById("moveModal");
  if (modal) modal.classList.add("hidden");
}

async function browseExternalDestination() {
  try {
    const res = await fetch("/api/pick-folder", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.path && data.path.trim()) {
        const input = document.getElementById("moveDestInput");
        if (input) {
          input.value = data.path.trim();
          updateMoveFolderStatus();
        }
      }
    }
  } catch (err) {
    if (typeof showToast === "function") showToast("Picker error");
  }
}

async function executeSelectedMove() {
  const dest = (document.getElementById("moveDestInput")?.value || "").trim();
  if (!dest) { if (typeof showToast === "function") showToast("Please enter or pick a destination folder"); return; }

  const ws = window.getActiveWorkspace();
  if (!ws) return;
  let paths = ws.getSelected();
  if (paths.length === 0 && ws.getState && ws.getState().isInspectMode) {
    const cur = ws.getCurrentItem();
    if (cur) paths = [cur.relative_path];
  }
  if (paths.length === 0) { if (typeof showToast === "function") showToast("Select or inspect photos first to move"); return; }

  closeMoveModal();
  closeAllDrawers();

  try {
    const res = await fetch("/api/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dir: ws.getDirectory(), dest_subfolder: dest, relative_paths: paths })
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = await res.json();
    const actionLabel = data.created_dir ? `Created '${dest}' & moved ${data.moved} item(s)` : `Moved ${data.moved} item(s) to ${dest}`;
    if (typeof showToast === "function") showToast(actionLabel, 2800);
    
    if (typeof setLastAction === "function" && data.moved > 0) {
      setLastAction({
        type: 'move',
        sourceDir: ws.getDirectory(),
        destDir: data.dest_dir || dest,
        relativePaths: data.moved_paths || paths
      });
    }

    ws.clearSelection();
    await rescanWorkspaces();
  } catch (err) { if (typeof showToast === "function") showToast("Move failed: " + err.message, 4000); }
}

async function executeTagSweep() {
  const tagInput = document.getElementById("sweepTagInput");
  const destInput = document.getElementById("moveDestInput");
  const tag = (tagInput ? tagInput.value : "").trim();
  if (!tag) {
    if (typeof showToast === "function") showToast("Specify a tag name in 'Sweep All Photos with Tag'");
    if (tagInput) tagInput.focus();
    return;
  }
  const destFolder = (destInput && destInput.value.trim()) ? destInput.value.trim() : tag;
  closeMoveModal();
  closeAllDrawers();
  if (typeof sweepTagToFolder === "function") await sweepTagToFolder(tag, destFolder);
}

async function quickMoveToJunk() {
  const ws = window.getActiveWorkspace();
  if (!ws) return;
  let paths = ws.getSelected();
  
  if (paths.length === 0) {
    const current = ws.getCurrentItem();
    if (current) paths = [current.relative_path];
  }

  if (paths.length === 0) {
    if (typeof showToast === "function") showToast("Select photos or inspect an item first to move to junk");
    return;
  }

  closeMoveModal();
  closeAllDrawers();

  try {
    const res = await fetch("/api/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dir: ws.getDirectory(), dest_subfolder: ".junk", relative_paths: paths })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (typeof showToast === "function") showToast(`Moved ${data.moved} items to .junk`);
    
    if (typeof setLastAction === "function" && data.moved > 0) {
      setLastAction({
        type: 'move',
        sourceDir: ws.getDirectory(),
        destDir: data.dest_dir || ".junk",
        relativePaths: data.moved_paths || paths
      });
    }

    ws.clearSelection();
    await rescanWorkspaces();
  } catch (err) { if (typeof showToast === "function") showToast("Junk failed: " + err.message); }
}

function launchNewSession() {
  const ws = window.getActiveWorkspace();
  const activeDir = (ws ? ws.getDirectory() : "") || (typeof currentDir !== "undefined" ? currentDir : "") || "";
  const targetUrl = activeDir ? `/?dir=${encodeURIComponent(activeDir)}` : "/";
  window.open(targetUrl, '_blank');
}

function showToast(msg, duration = 1800) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), duration);
}

function applySortTag(val) {
  if (primaryWorkspace && primaryWorkspace.setSortTag) primaryWorkspace.setSortTag(val);
  if (secondaryWorkspace && secondaryWorkspace.setSortTag) secondaryWorkspace.setSortTag(val);
}

async function applyCustomTagRemoval() {
  const input = document.getElementById("customTagInput");
  if (!input) return;
  const val = input.value.trim().toLowerCase();
  if (!val) return;
  const tags = val.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);

  const selA = primaryWorkspace ? primaryWorkspace.getSelected() : [];
  const selB = (isSplitMode && secondaryWorkspace) ? secondaryWorkspace.getSelected() : [];

  if (selA.length > 0) await primaryWorkspace.removeTagsBulk(tags);
  if (selB.length > 0) await secondaryWorkspace.removeTagsBulk(tags);
  if (selA.length === 0 && selB.length === 0) {
    const ws = window.getActiveWorkspace();
    if (ws) await ws.removeTagsBulk(tags);
  }
  input.value = "";
}

window.executeUndo = async function() {
  if (typeof lastAction === "undefined" || !lastAction) return;
  const ws = window.getActiveWorkspace ? window.getActiveWorkspace() : null;

  try {
    if (lastAction.type === 'move') {
      const res = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dir: lastAction.destDir,
          dest_subfolder: lastAction.sourceDir,
          relative_paths: lastAction.relativePaths
        })
      });
      if (res.ok) {
        showToast("Undo: Moved items back");
        if (typeof clearLastAction === "function") clearLastAction();
        await rescanWorkspaces();
      } else {
        const err = await res.text();
        showToast("Undo failed: " + err);
      }
    } else if (lastAction.type === 'tag_add') {
      const res = await fetch("/api/tags/remove-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dir: lastAction.dir,
          relative_paths: lastAction.relative_paths,
          tags: lastAction.tags
        })
      });
      if (res.ok) {
        showToast("Undo: Stripped added tags");
        if (typeof clearLastAction === "function") clearLastAction();
        if (ws) await ws.setDirectory(ws.getDirectory(), ws.getState());
      }
    } else if (lastAction.type === 'tag_remove') {
      const res = await fetch("/api/tags/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dir: lastAction.dir,
          relative_paths: lastAction.relative_paths,
          tags: lastAction.tags
        })
      });
      if (res.ok) {
        showToast("Undo: Restored removed tags");
        if (typeof clearLastAction === "function") clearLastAction();
        if (ws) await ws.setDirectory(ws.getDirectory(), ws.getState());
      }
    }
  } catch (err) {
    showToast("Undo failed: " + err.message);
  }
};

window.addEventListener("keydown", (e) => {
  const activeEl = document.activeElement;
  if (activeEl && ["INPUT", "TEXTAREA", "SELECT"].includes(activeEl.tagName)) return;

  const modals = [
    { id: "moveModal", closeFn: closeMoveModal },
    { id: "presetModal", closeFn: () => { if (typeof closePresetModal === "function") closePresetModal(); } },
    { id: "deckModal", closeFn: () => { if (typeof closeDeckModal === "function") closeDeckModal(); } }
  ];

  let isModalOpen = false;
  for (const modal of modals) {
    const el = document.getElementById(modal.id);
    if (el && !el.classList.contains("hidden")) {
      isModalOpen = true;
      if (e.key === "Escape") modal.closeFn();
      break;
    }
  }

  if (isModalOpen) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (window.executeUndo) window.executeUndo();
    }
    return;
  }

  const ssModal = document.getElementById("slideshowModal");
  if (ssModal && !ssModal.classList.contains("hidden")) {
    if (e.key === "Escape") { if (typeof closeSlideshowModal === "function") closeSlideshowModal(); }
    else if (e.key === " " || e.code === "Space") { e.preventDefault(); if (typeof toggleSlideshowPlayback === "function") toggleSlideshowPlayback(); }
    else if (e.key === "ArrowRight") { if (typeof navigateSlideshow === "function") navigateSlideshow(1); }
    else if (e.key === "ArrowLeft") { if (typeof navigateSlideshow === "function") navigateSlideshow(-1); }
    return;
  }

  const ws = window.getActiveWorkspace();
  const vid = ws ? ws.getVideoPlayer() : null;

  if (e.key === "Escape" && ws && ws.getState && ws.getState().isInspectMode) {
    ws.closeInspector();
    return;
  }

  if ((e.shiftKey && (e.key === "J" || e.key === "j")) || e.key === "Delete") {
    quickMoveToJunk();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
    e.preventDefault();
    if (window.executeUndo) window.executeUndo();
    return;
  }

  if (vid && (e.key === "f" || e.key === "F")) {
    e.preventDefault();
    ws.toggleFullscreen();
    return;
  }

  if (e.key === " " || e.code === "Space" || (vid && (e.key === "k" || e.key === "K"))) {
    if (vid) {
      e.preventDefault();
      ws.toggleVideoPlay();
      return;
    }
  }

  if (vid && !e.ctrlKey) {
    if (e.key === "ArrowLeft") { e.preventDefault(); ws.skipVideo(-1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); ws.skipVideo(1); return; }
  }

  if (ws) {
    if (e.key === "ArrowRight") ws.navigate(1);
    if (e.key === "ArrowLeft") ws.navigate(-1);
  }
  
  if (!vid && e.key.toLowerCase() === "j") quickMoveToJunk();
  if (e.key.toLowerCase() === "t") toggleInteractionMode();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
