function renderGrid() {
  const grid = document.getElementById("imageGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredEntries.slice(start, end);

  document.getElementById("emptyState").classList.toggle("hidden", filteredEntries.length > 0);
  document.getElementById("statusBar").textContent = `Showing ${pageItems.length} of ${filteredEntries.length} photos (Catalog: ${allEntries.length})`;
  
  const totalPages = Math.ceil(filteredEntries.length / pageSize) || 1;
  const pageText = `Page ${currentPage} / ${totalPages}`;
  
  document.getElementById("pageIndicator").textContent = pageText;
  document.querySelectorAll(".topPageIndicator").forEach(el => el.textContent = `${currentPage}/${totalPages}`);

  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= totalPages;

  document.getElementById("prevPageBtn").disabled = isPrevDisabled;
  document.getElementById("nextPageBtn").disabled = isNextDisabled;
  document.querySelectorAll(".topPrevBtn").forEach(b => b.disabled = isPrevDisabled);
  document.querySelectorAll(".topNextBtn").forEach(b => b.disabled = isNextDisabled);

  pageItems.forEach(item => {
    const isSelected = selectedSet.has(item.relative_path);
    const card = document.createElement("div");
    card.className = `group relative rounded border bg-zinc-950 overflow-hidden flex flex-col transition cursor-pointer select-none ${isSelected ? "border-sky-500 ring-2 ring-sky-500/50" : "border-zinc-800 hover:border-zinc-600"}`;
    
    // Explicit click routing: click image/card -> lightbox; click select box -> toggle select
    card.addEventListener("click", (e) => {
      if (e.target.closest(".select-btn") || e.target.closest(".tag-remove-btn")) {
        return;
      }
      if (isSelectMode) {
        toggleSelect(item.relative_path);
      } else {
        openLightbox(item.relative_path);
      }
    });

    const imgContainer = document.createElement("div");
    imgContainer.className = "aspect-square w-full bg-zinc-900 overflow-hidden relative pointer-events-none";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = `/api/thumbnail?dir=${encodeURIComponent(currentDir)}&file=${encodeURIComponent(item.relative_path)}`;
    img.className = "w-full h-full object-cover group-hover:scale-105 transition duration-200";

    const checkBtn = document.createElement("button");
    checkBtn.className = `select-btn absolute top-1.5 right-1.5 w-5 h-5 rounded border flex items-center justify-center text-xs transition z-10 ${isSelected ? "bg-sky-600 border-sky-400 text-white font-bold" : "border-zinc-600 bg-black/60 text-transparent hover:border-zinc-300"}`;
    checkBtn.innerHTML = "✓";
    checkBtn.onclick = (e) => {
      e.stopPropagation();
      toggleSelect(item.relative_path);
    };

    imgContainer.appendChild(img);
    card.appendChild(imgContainer);
    card.appendChild(checkBtn);

    const info = document.createElement("div");
    info.className = "p-1.5 flex flex-col gap-1 pointer-events-auto";

    const nameSpan = document.createElement("span");
    nameSpan.className = "text-[11px] font-mono text-zinc-300 truncate";
    nameSpan.textContent = item.file_name;

    const tagContainer = document.createElement("div");
    tagContainer.className = "flex flex-wrap gap-1";

    (item.tags || []).forEach(t => {
      const pill = document.createElement("span");
      pill.className = "text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-1.5 py-0.2 flex items-center gap-1";
      pill.innerHTML = `<span>${t}</span><button class="tag-remove-btn text-zinc-500 hover:text-zinc-200" onclick="event.stopPropagation(); removeTag('${item.relative_path}', '${t}')">✕</button>`;
      tagContainer.appendChild(pill);
    });

    info.appendChild(nameSpan);
    info.appendChild(tagContainer);
    card.appendChild(info);
    grid.appendChild(card);
  });
}

function toggleInteractionMode() {
  isSelectMode = !isSelectMode;
  const btn = document.getElementById("modeToggleBtn");
  const icon = document.getElementById("modeIcon");
  const label = document.getElementById("modeLabel");

  if (isSelectMode) {
    btn.className = "px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold border border-sky-400 flex items-center gap-1 transition shadow-lg shadow-sky-600/30";
    icon.textContent = "☑";
    label.textContent = "Select";
  } else {
    btn.className = "px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded text-xs font-bold border border-zinc-700 flex items-center gap-1 transition";
    icon.textContent = "🔍";
    label.textContent = "Inspect";
  }
}

function toggleSelect(rel) {
  if (selectedSet.has(rel)) {
    selectedSet.delete(rel);
  } else {
    selectedSet.add(rel);
  }
  updateSelectionUI();
}

function selectVisible() {
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  filteredEntries.slice(start, end).forEach(item => selectedSet.add(item.relative_path));
  updateSelectionUI();
}

function clearSelection() {
  selectedSet.clear();
  updateSelectionUI();
}

function updateSelectionUI() {
  document.getElementById("selectionCount").textContent = `${selectedSet.size} sel`;
  renderGrid();
}

function setDensity(mode) {
  const g = document.getElementById("imageGrid");
  g.className = `grid grid-${mode} gap-2.5`;
  document.getElementById("denseBtn").className = mode === 'dense' ? "px-1.5 py-0.5 text-[11px] bg-sky-700 text-white border-r border-zinc-800" : "px-1.5 py-0.5 text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-r border-zinc-800";
  document.getElementById("stdBtn").className = mode === 'standard' ? "px-1.5 py-0.5 text-[11px] bg-sky-700 text-white border-r border-zinc-800" : "px-1.5 py-0.5 text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-r border-zinc-800";
  document.getElementById("largeBtn").className = mode === 'large' ? "px-1.5 py-0.5 text-[11px] bg-sky-700 text-white" : "px-1.5 py-0.5 text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300";
}

function changePageSize(val) {
  pageSize = parseInt(val, 10);
  currentPage = 1;
  renderGrid();
}

function changePage(delta) {
  currentPage += delta;
  renderGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleUntaggedOnly() {
  untaggedOnly = !untaggedOnly;
  const btn = document.getElementById("untaggedToggleBtn");
  btn.className = untaggedOnly 
    ? "px-2.5 py-1 bg-amber-600 text-white rounded text-xs font-bold transition shrink-0"
    : "px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded text-xs font-semibold transition shrink-0";
  applyFilters();
}

function clearSearch() {
  const search = document.getElementById("searchInput");
  if (search) {
    search.value = "";
    applyFilters();
  }
}

function applyFilters() {
  const query = (document.getElementById("searchInput").value || "").trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);

  filteredEntries = allEntries.filter(item => {
    if (untaggedOnly && item.tags && item.tags.length > 0) return false;

    const tagsLower = (item.tags || []).map(t => t.toLowerCase());
    const fileNameLower = item.file_name.toLowerCase();

    for (const term of terms) {
      if (term.startsWith("-")) {
        const neg = term.slice(1);
        if (neg && (tagsLower.includes(neg) || fileNameLower.includes(neg))) return false;
      } else {
        const matchedTag = tagsLower.some(t => t.includes(term));
        const matchedName = fileNameLower.includes(term);
        if (!matchedTag && !matchedName) return false;
      }
    }
    return true;
  });

  currentPage = 1;
  renderGrid();
}

function openCompareTab() {
  const targetDir = currentDir || "";
  window.open(`/compare.html?dir=${encodeURIComponent(targetDir)}`, "_blank");
}
