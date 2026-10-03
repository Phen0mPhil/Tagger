// Isolated Compare Controller

const paneA = { dir: "", entries: [], index: 0, pz: null, nav: null };
const paneB = { dir: "", entries: [], index: 0, pz: null, nav: null };
let tagTarget = "B";

let presets = JSON.parse(localStorage.getItem("tag_presets")) || {
  "General": ["keeper", "best", "fix background", "delete uncle", "blink", "out of focus", "portrait", "candid"]
};
let activePresetKey = Object.keys(presets)[0] || "General";

async function initCompare() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialDir = urlParams.get("dir") || "";

  paneA.pz = createPanZoom(document.getElementById("containerA"), document.getElementById("imgA"));
  paneB.pz = createPanZoom(document.getElementById("containerB"), document.getElementById("imgB"));

  // Instantiate decoupled directory navigators
  paneA.nav = createDirectoryNavigator({
    breadcrumbEl: document.getElementById("breadcrumbBarA"),
    subfolderEl: document.getElementById("subfolderBarA"),
    onNavigate: (newPath) => loadDirectoryIntoPane("A", newPath)
  });

  paneB.nav = createDirectoryNavigator({
    breadcrumbEl: document.getElementById("breadcrumbBarB"),
    subfolderEl: document.getElementById("subfolderBarB"),
    onNavigate: (newPath) => loadDirectoryIntoPane("B", newPath)
  });

  paneA.pz.onSync((s, x, y) => {
    if (document.getElementById("syncZoomCheck").checked && paneB.pz) {
      paneB.pz.setTransform(s, x, y);
    }
  });

  paneB.pz.onSync((s, x, y) => {
    if (document.getElementById("syncZoomCheck").checked && paneA.pz) {
      paneA.pz.setTransform(s, x, y);
    }
  });

  renderComparePresetSelector();

  if (initialDir) {
    await loadDirectoryIntoPane("A", initialDir);
    await loadDirectoryIntoPane("B", initialDir);
    if (paneB.entries.length > 1) {
      paneB.index = 1;
      renderPane("B");
    }
  }
}

async function loadDirectoryIntoPane(paneKey, dir) {
  if (!dir) return;
  const p = paneKey === "A" ? paneA : paneB;
  p.dir = dir;

  try {
    await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dir, recursive: false })
    });

    const res = await fetch(`/api/entries?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) return;

    p.entries = await res.json();
    p.index = 0;
    if (p.pz) p.pz.reset();
    renderPane(paneKey);

    if (p.nav) {
      await p.nav.update(dir);
    }
  } catch (err) {
    console.error("Load pane failed:", err);
  }
}

function renderPane(paneKey) {
  const p = paneKey === "A" ? paneA : paneB;
  const imgEl = document.getElementById(`img${paneKey}`);
  const counterEl = document.getElementById(`counter${paneKey}`);
  const fileEl = document.getElementById(`fileName${paneKey}`);
  const tagsListEl = document.getElementById(`tagsList${paneKey}`);

  if (!p.entries || p.entries.length === 0) {
    imgEl.src = "";
    counterEl.textContent = "0 / 0";
    fileEl.textContent = "No images found";
    tagsListEl.innerHTML = "";
    return;
  }

  const item = p.entries[p.index];
  imgEl.src = `/api/image?dir=${encodeURIComponent(p.dir)}&file=${encodeURIComponent(item.relative_path)}`;
  counterEl.textContent = `${p.index + 1} / ${p.entries.length}`;
  fileEl.textContent = item.file_name;

  tagsListEl.innerHTML = "";
  (item.tags || []).forEach(t => {
    const chip = document.createElement("span");
    chip.className = "text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-1.5 py-0.2 flex items-center gap-1";
    chip.innerHTML = `<span>${t}</span><button class="text-zinc-500 hover:text-white" onclick="removeTagFromPane('${paneKey}', '${item.relative_path}', '${t}')">✕</button>`;
    tagsListEl.appendChild(chip);
  });
}

function navPane(paneKey, delta) {
  const p = paneKey === "A" ? paneA : paneB;
  if (!p.entries || p.entries.length === 0) return;
  p.index = (p.index + delta + p.entries.length) % p.entries.length;
  if (p.pz) p.pz.reset();
  renderPane(paneKey);
}

async function pickDirectoryForPane(paneKey) {
  try {
    const res = await fetch("/api/pick-folder", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.path && data.path.trim()) {
        await loadDirectoryIntoPane(paneKey, data.path.trim());
        return;
      }
    }
  } catch (err) {
    console.warn("Picker call failed:", err);
  }

  const current = paneKey === "A" ? paneA.dir : paneB.dir;
  const manual = prompt(`Folder path for Pane ${paneKey}:`, current || "");
  if (manual && manual.trim()) {
    await loadDirectoryIntoPane(paneKey, manual.trim());
  }
}

function swapPanes() {
  const tempDir = paneA.dir;
  const tempEntries = paneA.entries;
  const tempIndex = paneA.index;

  paneA.dir = paneB.dir;
  paneA.entries = paneB.entries;
  paneA.index = paneB.index;

  paneB.dir = tempDir;
  paneB.entries = tempEntries;
  paneB.index = tempIndex;

  if (paneA.pz) paneA.pz.reset();
  if (paneB.pz) paneB.pz.reset();

  renderPane("A");
  renderPane("B");

  if (paneA.nav && paneA.dir) paneA.nav.update(paneA.dir);
  if (paneB.nav && paneB.dir) paneB.nav.update(paneB.dir);
}

function setTagTarget(target) {
  tagTarget = target;
  const btnA = document.getElementById("targetBtnA");
  const btnB = document.getElementById("targetBtnB");
  const btnBoth = document.getElementById("targetBtnBoth");

  [btnA, btnB, btnBoth].forEach(b => {
    b.className = "px-2.5 py-0.5 rounded text-xs font-semibold text-zinc-400 hover:text-white transition";
  });

  if (target === "A") {
    btnA.className = "px-2.5 py-0.5 rounded text-xs font-semibold bg-sky-600 text-white shadow transition";
  } else if (target === "B") {
    btnB.className = "px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-600 text-white shadow transition";
  } else {
    btnBoth.className = "px-2.5 py-0.5 rounded text-xs font-semibold bg-purple-600 text-white shadow transition";
  }
}

function renderComparePresetSelector() {
  const sel = document.getElementById("comparePresetSelect");
  if (!sel) return;
  sel.innerHTML = "";
  Object.keys(presets).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === activePresetKey) opt.selected = true;
    sel.appendChild(opt);
  });
  renderComparePalette();
}

function handleComparePresetChange(val) {
  activePresetKey = val;
  renderComparePalette();
}

function renderComparePalette() {
  const container = document.getElementById("comparePaletteContainer");
  if (!container) return;
  container.innerHTML = "";
  const currentTags = presets[activePresetKey] || [];

  currentTags.slice(0, 20).forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 text-zinc-200 rounded text-xs font-medium transition shrink-0";
    btn.textContent = tag;
    btn.onclick = () => applyTagToTarget([tag]);
    container.appendChild(btn);
  });
}

function openComparePresetModal() {
  const m = document.getElementById("comparePresetModal");
  m.classList.remove("hidden");
  const sel = document.getElementById("modalComparePresetSelect");
  sel.innerHTML = "";
  Object.keys(presets).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === activePresetKey) opt.selected = true;
    sel.appendChild(opt);
  });
  renderComparePresetModalTags();
}

function closeComparePresetModal() {
  document.getElementById("comparePresetModal").classList.add("hidden");
  localStorage.setItem("tag_presets", JSON.stringify(presets));
  renderComparePresetSelector();
}

function renderComparePresetModalTags() {
  const selName = document.getElementById("modalComparePresetSelect").value;
  const list = document.getElementById("modalCompareTagList");
  list.innerHTML = "";
  (presets[selName] || []).forEach(t => {
    const pill = document.createElement("span");
    pill.className = "text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-2 py-0.5 flex items-center gap-1.5";
    pill.innerHTML = `<span>${t}</span><button class="text-zinc-500 hover:text-white" onclick="deleteTagFromComparePreset('${selName}', '${t}')">✕</button>`;
    list.appendChild(pill);
  });
}

function addTagToCurrentComparePreset() {
  const selName = document.getElementById("modalComparePresetSelect").value;
  const inp = document.getElementById("modalCompareNewTagInput");
  const val = inp.value.trim().toLowerCase();
  if (!val) return;
  if (!presets[selName].includes(val)) {
    presets[selName].push(val);
  }
  inp.value = "";
  renderComparePresetModalTags();
}

function deleteTagFromComparePreset(preset, tag) {
  presets[preset] = presets[preset].filter(t => t !== tag);
  renderComparePresetModalTags();
}

function createNewComparePresetPrompt() {
  const name = prompt("Enter new palette name:");
  if (name && !presets[name]) {
    presets[name] = [];
    activePresetKey = name;
    openComparePresetModal();
  }
}

function deleteCurrentComparePreset() {
  const selName = document.getElementById("modalComparePresetSelect").value;
  if (Object.keys(presets).length <= 1) {
    alert("You must keep at least one palette.");
    return;
  }
  delete presets[selName];
  activePresetKey = Object.keys(presets)[0];
  openComparePresetModal();
}

async function applyTagToTarget(tags) {
  const targets = [];
  if ((tagTarget === "A" || tagTarget === "BOTH") && paneA.entries.length > 0) {
    targets.push({ dir: paneA.dir, rel: paneA.entries[paneA.index].relative_path, paneKey: "A" });
  }
  if ((tagTarget === "B" || tagTarget === "BOTH") && paneB.entries.length > 0) {
    targets.push({ dir: paneB.dir, rel: paneB.entries[paneB.index].relative_path, paneKey: "B" });
  }

  for (const t of targets) {
    await fetch("/api/tags/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dir: t.dir, relative_paths: [t.rel], tags: tags })
    });
    
    const refreshed = await (await fetch(`/api/entries?dir=${encodeURIComponent(t.dir)}`)).json();
    if (t.paneKey === "A") {
      paneA.entries = refreshed;
      renderPane("A");
    } else {
      paneB.entries = refreshed;
      renderPane("B");
    }
  }
}

async function applyCustomCompareTag() {
  const input = document.getElementById("compareCustomTagInput");
  const val = input.value.trim();
  if (!val) return;
  const tags = val.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  await applyTagToTarget(tags);
  input.value = "";
}

async function removeTagFromPane(paneKey, rel, tag) {
  const p = paneKey === "A" ? paneA : paneB;
  await fetch("/api/tags/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dir: p.dir, relative_path: rel, tag: tag })
  });

  const refreshed = await (await fetch(`/api/entries?dir=${encodeURIComponent(p.dir)}`)).json();
  p.entries = refreshed;
  renderPane(paneKey);
}

window.addEventListener("keydown", (e) => {
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;

  if (e.key === "ArrowLeft") navPane("B", -1);
  if (e.key === "ArrowRight") navPane("B", 1);
  if (e.key === "a" || e.key === "A") navPane("A", -1);
  if (e.key === "d" || e.key === "D") navPane("A", 1);
  if (e.key === "s" || e.key === "S") swapPanes();
});

window.onload = initCompare;
