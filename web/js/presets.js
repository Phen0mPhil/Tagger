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
  if (window.mainTagDock) window.mainTagDock.setPalette(activePresetKey);
}

function handlePresetChange(val) {
  activePresetKey = val;
  if (window.mainTagDock) window.mainTagDock.setPalette(val);
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
    pill.className = "text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1 flex items-center gap-2";
    pill.innerHTML = `<span>${t}</span><button class="text-zinc-500 hover:text-white font-bold" onclick="deleteTagFromPreset('${selName}', '${t}')">✕</button>`;
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

function renameCurrentPalette() {
  const sel = document.getElementById("modalPresetSelect");
  const inp = document.getElementById("renamePaletteInput");
  const oldName = sel.value;
  const newName = inp.value.trim();

  if (!newName || newName === oldName) return;
  if (presets[newName]) {
    alert("A palette with that name already exists.");
    return;
  }

  presets[newName] = presets[oldName];
  delete presets[oldName];
  activePresetKey = newName;

  localStorage.setItem("tag_presets", JSON.stringify(presets));
  openPresetModal();
  renderPresetSelector();
  showToast(`Palette renamed to '${newName}'`);
}
