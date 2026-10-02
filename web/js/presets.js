function renderPresetSelector() {
  const sel = document.getElementById("presetSelect");
  if (!sel) return;
  sel.innerHTML = "";
  Object.keys(presets).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === activePresetKey) opt.selected = true;
    sel.appendChild(opt);
  });
  renderPresetPills();
}

function renderPresetPills() {
  const container = document.getElementById("palettePills");
  if (!container) return;
  container.innerHTML = "";
  const currentTags = presets[activePresetKey] || [];

  // Expanded to 20 clickable tags with clean styling
  currentTags.slice(0, 20).forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "px-2.5 py-1 bg-zinc-900 hover:bg-sky-950 border border-zinc-800 hover:border-sky-600 text-zinc-200 hover:text-sky-300 rounded text-xs font-medium transition shrink-0";
    btn.textContent = tag;
    btn.onclick = () => applyTagBatch([tag]);
    container.appendChild(btn);
  });
}

function handlePresetChange(val) {
  activePresetKey = val;
  renderPresetPills();
}

function openPresetModal() {
  const m = document.getElementById("presetModal");
  m.classList.remove("hidden");
  const sel = document.getElementById("modalPresetSelect");
  sel.innerHTML = "";
  Object.keys(presets).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === activePresetKey) opt.selected = true;
    sel.appendChild(opt);
  });
  renderPresetModalTags();
}

function closePresetModal() {
  document.getElementById("presetModal").classList.add("hidden");
  localStorage.setItem("tag_presets", JSON.stringify(presets));
  renderPresetSelector();
}

function renderPresetModalTags() {
  const selName = document.getElementById("modalPresetSelect").value;
  const list = document.getElementById("modalTagList");
  list.innerHTML = "";
  (presets[selName] || []).forEach(t => {
    const pill = document.createElement("span");
    pill.className = "text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-2 py-0.5 flex items-center gap-1.5";
    pill.innerHTML = `<span>${t}</span><button class="text-zinc-500 hover:text-white" onclick="deleteTagFromPreset('${selName}', '${t}')">✕</button>`;
    list.appendChild(pill);
  });
}

function addTagToCurrentPreset() {
  const selName = document.getElementById("modalPresetSelect").value;
  const inp = document.getElementById("modalNewTagInput");
  const val = inp.value.trim().toLowerCase();
  if (!val) return;
  if (!presets[selName].includes(val)) {
    presets[selName].push(val);
  }
  inp.value = "";
  renderPresetModalTags();
}

function deleteTagFromPreset(preset, tag) {
  presets[preset] = presets[preset].filter(t => t !== tag);
  renderPresetModalTags();
}

function createNewPresetPrompt() {
  const name = prompt("Enter new palette name:");
  if (name && !presets[name]) {
    presets[name] = [];
    activePresetKey = name;
    openPresetModal();
  }
}

function deleteCurrentPreset() {
  const selName = document.getElementById("modalPresetSelect").value;
  if (Object.keys(presets).length <= 1) {
    alert("You must keep at least one palette.");
    return;
  }
  delete presets[selName];
  activePresetKey = Object.keys(presets)[0];
  openPresetModal();
}
