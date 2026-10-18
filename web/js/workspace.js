function createWorkspace({ id, containerEl, onFocusChange }) {
  let dir = "";
  let entries = [];
  let filtered = [];
  let selected = new Set();
  let currentIndex = 0;
  let pzInstance = null;
  let isInspectMode = false;
  let isViewingJunk = false;
  let page = 1;
  let localSearchQuery = "";
  let localSortTag = "";
  let globalSortTag = "";
  let localSort = "name_asc";
  let skipInterval = 5;
  let playbackSpeed = 1.0;

  containerEl.innerHTML = getWorkspaceTemplate();

  const root = containerEl.querySelector(".workspace-root");
  const breadcrumbStrip = root.querySelector(".ws-breadcrumbs-strip");
  const restoreJunkBtn = root.querySelector(".ws-restore-junk-btn");
  const gridEl = root.querySelector(".ws-grid");
  const inspectorEl = root.querySelector(".ws-inspector");
  const inspectedImg = root.querySelector(".ws-inspected-img");
  const videoStage = root.querySelector(".ws-video-stage");
  const inspectedVideo = root.querySelector(".ws-inspected-video");
  const videoControls = root.querySelector(".ws-video-controls");
  
  const vidPlayBtn = root.querySelector(".ws-vid-play-btn");
  const vidStopBtn = root.querySelector(".ws-vid-stop-btn");
  const vidRewindBtn = root.querySelector(".ws-vid-rewind-btn");
  const vidFfBtn = root.querySelector(".ws-vid-ff-btn");
  const vidTime = root.querySelector(".ws-vid-time");
  const vidSeek = root.querySelector(".ws-vid-seek");
  const vidMuteBtn = root.querySelector(".ws-vid-mute-btn");
  const vidVolume = root.querySelector(".ws-vid-volume");
  const vidFullscreenBtn = root.querySelector(".ws-vid-fullscreen-btn");

  const rate05xBtn = root.querySelector(".ws-rate-05x");
  const rate1xBtn = root.querySelector(".ws-rate-1x");
  const rate15xBtn = root.querySelector(".ws-rate-15x");

  const counterEl = root.querySelector(".ws-counter");
  const selectCountBtn = root.querySelector(".ws-select-count-btn");
  const selectCountText = root.querySelector(".ws-select-count-text");
  const fileNameEl = root.querySelector(".ws-file-name");
  const itemTagsEl = root.querySelector(".ws-item-tags");
  const inspectBtn = root.querySelector(".ws-inspect-btn");
  const closeInspectorBtn = root.querySelector(".ws-close-inspector-btn");
  const aiStudioBtn = root.querySelector(".ws-ai-studio-btn");
  const prevBtn = root.querySelector(".ws-prev-btn");
  const nextBtn = root.querySelector(".ws-next-btn");
  const viewportEl = root.querySelector(".ws-viewport");

  const pageStatus = root.querySelector(".ws-page-status");
  const pageIndicator = root.querySelector(".ws-page-indicator");
  const prevPageBtn = root.querySelector(".ws-prev-page");
  const nextPageBtn = root.querySelector(".ws-next-page");

  const localSearchInput = root.querySelector(".ws-local-search");
  const localTagSortInput = root.querySelector(".ws-tag-sort-input");
  const localSortSelect = root.querySelector(".ws-local-sort");

  pzInstance = createPanZoom(viewportEl, inspectedImg);

  function formatTime(secs) {
    const m = Math.floor(secs / 60) || 0;
    const s = Math.floor(secs % 60) || 0;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function setPlaybackSpeed(rate) {
    playbackSpeed = rate;
    if (inspectedVideo) inspectedVideo.playbackRate = rate;
    if (rate05xBtn) rate05xBtn.className = rate === 0.5 ? "ws-rate-05x px-3 py-2 bg-rose-600 text-white transition border-r border-zinc-800" : "ws-rate-05x px-3 py-2 text-zinc-400 hover:text-white transition border-r border-zinc-800";
    if (rate1xBtn) rate1xBtn.className = rate === 1.0 ? "ws-rate-1x px-3 py-2 bg-rose-600 text-white transition border-r border-zinc-800" : "ws-rate-1x px-3 py-2 text-zinc-400 hover:text-white transition border-r border-zinc-800";
    if (rate15xBtn) rate15xBtn.className = rate === 1.5 ? "ws-rate-15x px-3 py-2 bg-rose-600 text-white transition" : "ws-rate-15x px-3 py-2 text-zinc-400 hover:text-white transition";
  }

  if (rate05xBtn) rate05xBtn.onclick = (e) => { e.stopPropagation(); setPlaybackSpeed(0.5); };
  if (rate1xBtn) rate1xBtn.onclick = (e) => { e.stopPropagation(); setPlaybackSpeed(1.0); };
  if (rate15xBtn) rate15xBtn.onclick = (e) => { e.stopPropagation(); setPlaybackSpeed(1.5); };

  function toggleVideoPlay() {
    if (inspectedVideo.paused) {
      inspectedVideo.play();
      vidPlayBtn.innerHTML = "<span>⏸</span> <span class=\"ws-vid-play-label\">Pause</span>";
    } else {
      inspectedVideo.pause();
      vidPlayBtn.innerHTML = "<span>▶</span> <span class=\"ws-vid-play-label\">Play</span>";
    }
  }

  function stopVideo() {
    inspectedVideo.pause();
    inspectedVideo.currentTime = 0;
    vidPlayBtn.innerHTML = "<span>▶</span> <span class=\"ws-vid-play-label\">Play</span>";
  }

  function skipVideo(delta) {
    if (!inspectedVideo.duration) return;
    inspectedVideo.currentTime = Math.max(0, Math.min(inspectedVideo.duration, inspectedVideo.currentTime + delta));
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (videoStage.requestFullscreen) videoStage.requestFullscreen();
      else if (inspectedVideo.requestFullscreen) inspectedVideo.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }

  vidPlayBtn.onclick = (e) => { e.stopPropagation(); toggleVideoPlay(); };
  vidStopBtn.onclick = (e) => { e.stopPropagation(); stopVideo(); };
  vidRewindBtn.onclick = (e) => { e.stopPropagation(); skipVideo(-skipInterval); };
  vidFfBtn.onclick = (e) => { e.stopPropagation(); skipVideo(skipInterval); };
  inspectedVideo.onclick = (e) => { e.stopPropagation(); toggleVideoPlay(); };
  inspectedVideo.ondblclick = (e) => { e.stopPropagation(); toggleFullscreen(); };
  vidFullscreenBtn.onclick = (e) => { e.stopPropagation(); toggleFullscreen(); };

  inspectedVideo.ontimeupdate = () => {
    if (!inspectedVideo.duration) return;
    const pct = (inspectedVideo.currentTime / inspectedVideo.duration) * 100;
    vidSeek.value = pct;
    vidTime.textContent = `${formatTime(inspectedVideo.currentTime)} / ${formatTime(inspectedVideo.duration)}`;
  };

  vidSeek.oninput = () => {
    if (!inspectedVideo.duration) return;
    inspectedVideo.currentTime = (vidSeek.value / 100) * inspectedVideo.duration;
  };

  vidVolume.oninput = () => {
    inspectedVideo.volume = parseFloat(vidVolume.value);
    inspectedVideo.muted = inspectedVideo.volume === 0;
    vidMuteBtn.textContent = inspectedVideo.muted ? "🔇" : "🔊";
  };

  vidMuteBtn.onclick = (e) => {
    e.stopPropagation();
    inspectedVideo.muted = !inspectedVideo.muted;
    vidMuteBtn.textContent = inspectedVideo.muted ? "🔇" : "🔊";
    if (!inspectedVideo.muted && inspectedVideo.volume === 0) {
      inspectedVideo.volume = 0.5;
      vidVolume.value = 0.5;
    }
  };

  function setActiveHighlight(isActive) {
    if (isActive) root.classList.add("ring-2", "ring-sky-500", "border-sky-500");
    else root.classList.remove("ring-2", "ring-sky-500", "border-sky-500");
  }

  function toggleSplitModeUI(isSplit) {
    if (localSearchInput) {
      localSearchInput.parentElement.classList.toggle("hidden", !isSplit);
      localSearchInput.parentElement.classList.toggle("flex", isSplit);
    }
    if (counterEl) counterEl.classList.toggle("hidden", isSplit);
    if (localTagSortInput) {
      localTagSortInput.classList.toggle("hidden", !isSplit);
      localTagSortInput.classList.toggle("block", isSplit);
    }
  }

  if (localSearchInput) localSearchInput.oninput = (e) => { localSearchQuery = e.target.value.trim().toLowerCase(); applyFilters(); };
  if (localTagSortInput) localTagSortInput.oninput = (e) => { localSortTag = e.target.value.trim().toLowerCase(); applyFilters(); };
  if (localSortSelect) localSortSelect.onchange = (e) => { localSort = e.target.value; applyFilters(); };

  async function renderBreadcrumbHops(currentPath) {
    if (!currentPath) {
      breadcrumbStrip.innerHTML = '<span class="text-zinc-600 font-bold text-sm">Path:</span> <span class="text-zinc-500 italic text-sm">No folder</span>';
      return;
    }

    try {
      const res = await fetch(`/api/browse?dir=${encodeURIComponent(currentPath)}`);
      if (!res.ok) return;
      const data = await res.json();

      breadcrumbStrip.innerHTML = '<span class="text-zinc-500 font-bold text-sm">Path:</span>';
      const parts = data.current_path.split("/").filter(Boolean);
      let accum = data.current_path.startsWith("/") ? "/" : "";

      parts.forEach((p, idx) => {
        if (idx === 0 && p.includes(":")) {
          accum = p.toLowerCase() + "/";
        } else {
          accum += (accum.endsWith("/") ? "" : "/") + p;
        }
        const hopPath = accum;

        const btn = document.createElement("button");
        btn.className = "px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-sky-500 rounded-lg text-sm font-bold font-mono text-zinc-200 hover:text-sky-300 transition shrink-0";
        btn.textContent = p;
        btn.onclick = async (e) => { 
          e.stopPropagation(); 
          closeInspector(); 
          await setDirectory(hopPath); 
        };
        breadcrumbStrip.appendChild(btn);

        if (idx < parts.length - 1) {
          const slash = document.createElement("span");
          slash.className = "text-zinc-600 text-sm font-bold px-1";
          slash.textContent = "/";
          breadcrumbStrip.appendChild(slash);
        }
      });

      (data.subfolders || []).forEach(sub => {
        const b = document.createElement("button");
        b.className = "px-3 py-1.5 bg-zinc-900/90 hover:bg-sky-950 border border-zinc-800 hover:border-sky-700 text-zinc-400 hover:text-sky-300 rounded-lg text-sm font-bold truncate max-w-[160px] transition shrink-0 ml-1.5";
        b.textContent = `📁 ${sub.name}`;
        b.onclick = async (e) => { 
          e.stopPropagation(); 
          closeInspector(); 
          await setDirectory(sub.path); 
        };
        breadcrumbStrip.appendChild(b);
      });
    } catch (e) {}
  }

  async function setDirectory(newDir, preserveState = null) {
    if (!newDir) return;
    dir = newDir;
    currentDir = newDir;
    isViewingJunk = newDir.endsWith("/.junk") || newDir.endsWith("\\.junk") || newDir.endsWith(".junk");
    if (restoreJunkBtn) restoreJunkBtn.classList.toggle("hidden", !isViewingJunk);

    try {
      const scanRes = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dir, recursive: document.getElementById("recursiveCheck")?.checked || false })
      });
      if (!scanRes.ok) {
        if (typeof showToast === "function") showToast("Cannot access folder: " + (await scanRes.text()).substring(0, 50));
        return;
      }

      const res = await fetch(`/api/entries?dir=${encodeURIComponent(dir)}`);
      if (!res.ok) return;

      entries = await res.json();
      selected.clear();
      page = 1;
      applyFilters();
      await renderBreadcrumbHops(dir);

      if (preserveState) {
        currentIndex = Math.min(preserveState.currentIndex, Math.max(0, filtered.length - 1));
        if (preserveState.isInspectMode && filtered.length > 0) openInspector(currentIndex);
        else closeInspector();
      }
    } catch (err) {
      console.error("Workspace dir error:", err);
    }
  }

  function applyFilters() {
    const globalSQuery = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    const globalEQuery = (document.getElementById("excludeInput")?.value || "").trim().toLowerCase();

    let inspectedRelPath = null;
    if (isInspectMode && filtered[currentIndex]) {
      inspectedRelPath = filtered[currentIndex].relative_path;
    }

    filtered = entries.filter(item => {
      if (typeof untaggedOnly !== "undefined" && untaggedOnly && item.tags && item.tags.length > 0) return false;
      const tagsLower = (item.tags || []).map(t => t.toLowerCase());
      const nameLower = item.file_name.toLowerCase();

      if (globalEQuery && (tagsLower.some(t => t.includes(globalEQuery)) || nameLower.includes(globalEQuery))) return false;
      if (globalSQuery && !tagsLower.some(t => t.includes(globalSQuery)) && !nameLower.includes(globalSQuery)) return false;
      if (localSearchQuery && !tagsLower.some(t => t.includes(localSearchQuery)) && !nameLower.includes(localSearchQuery)) return false;

      return true;
    });

    const activePriorityTag = localSortTag || globalSortTag;

    filtered.sort((a, b) => {
      const tagsA = (a.tags || []).map(t => t.toLowerCase());
      const tagsB = (b.tags || []).map(t => t.toLowerCase());

      if (activePriorityTag) {
        const aHas = tagsA.some(t => t.includes(activePriorityTag));
        const bHas = tagsB.some(t => t.includes(activePriorityTag));
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
      }

      if (localSort === "first_tag") {
        const tA = tagsA.length > 0 ? tagsA[0] : "zzzzzz";
        const tB = tagsB.length > 0 ? tagsB[0] : "zzzzzz";
        if (tA !== tB) return tA.localeCompare(tB);
      } else if (localSort === "second_tag") {
        const tA = tagsA.length > 1 ? tagsA[1] : (tagsA.length > 0 ? "zzzzza_" + tagsA[0] : "zzzzzz");
        const tB = tagsB.length > 1 ? tagsB[1] : (tagsB.length > 0 ? "zzzzza_" + tagsB[0] : "zzzzzz");
        if (tA !== tB) return tA.localeCompare(tB);
      } else if (localSort === "most_tags") {
        if (tagsB.length !== tagsA.length) return tagsB.length - tagsA.length;
      } else if (localSort === "size_desc") {
        if ((b.file_size || 0) !== (a.file_size || 0)) return (b.file_size || 0) - (a.file_size || 0);
      }

      return a.file_name.localeCompare(b.file_name);
    });

    if (inspectedRelPath) {
      const newIdx = filtered.findIndex(e => e.relative_path === inspectedRelPath);
      if (newIdx !== -1) {
        currentIndex = newIdx;
      } else {
        closeInspector();
      }
    } else {
      if (currentIndex >= filtered.length) currentIndex = 0;
    }
    
    renderGrid();
    updateCounter();
    if (isInspectMode) renderInspector();
  }

  function renderGrid() {
    gridEl.innerHTML = "";
    const limit = (typeof pageSize !== "undefined") ? pageSize : 100;
    const isCapped = limit < 99999;
    const totalPages = Math.ceil(filtered.length / limit) || 1;

    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;

    const start = (page - 1) * limit;
    const end = isCapped ? start + limit : filtered.length;
    const pageItems = filtered.slice(start, end);

    if (pageStatus) pageStatus.textContent = `Showing ${pageItems.length}/${filtered.length}`;
    if (pageIndicator) pageIndicator.textContent = `${page}/${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = page <= 1;
    if (nextPageBtn) nextPageBtn.disabled = page >= totalPages;

    pageItems.forEach((item, idx) => {
      const globalIdx = start + idx;
      const isSelected = selected.has(item.relative_path);
      const isVid = isVideoFile(item.file_name);

      const card = document.createElement("div");
      card.dataset.rel = item.relative_path;
      card.className = `group relative rounded-lg border bg-zinc-950 overflow-hidden flex flex-col cursor-pointer select-none transition ${
        isSelected ? "border-rose-500 ring-2 ring-rose-500/60" : "border-zinc-800 hover:border-zinc-600"
      }`;

      const imgContainer = document.createElement("div");
      imgContainer.className = "aspect-square w-full bg-zinc-900 overflow-hidden relative pointer-events-none";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = `/api/thumbnail?dir=${encodeURIComponent(dir)}&file=${encodeURIComponent(item.relative_path)}`;
      img.className = "w-full h-full object-cover group-hover:scale-105 transition duration-200";

      const checkBtn = document.createElement("button");
      checkBtn.className = `select-btn absolute top-2 right-2 w-7 h-7 rounded border flex items-center justify-center text-sm transition z-10 ${
        isSelected ? "bg-rose-600 border-rose-400 text-white font-bold" : "border-zinc-500 bg-black/60 text-transparent hover:border-zinc-300"
      }`;
      checkBtn.innerHTML = "✓";
      checkBtn.onclick = (e) => { e.stopPropagation(); toggleSelect(item.relative_path); };

      if (isVid) {
        const badge = document.createElement("span");
        badge.className = "absolute bottom-2 left-2 bg-sky-950/90 border border-sky-600/80 text-sky-300 font-black text-xs px-2.5 py-0.5 rounded tracking-wider z-10 flex items-center gap-1.5 shadow";
        badge.innerHTML = "▶ MP4";
        imgContainer.appendChild(badge);
      }

      imgContainer.appendChild(img);
      card.appendChild(imgContainer);
      card.appendChild(checkBtn);

      const info = document.createElement("div");
      info.className = "p-3 flex flex-col gap-2 pointer-events-auto";

      const nameSpan = document.createElement("span");
      nameSpan.className = "text-xs font-mono text-zinc-300 truncate";
      nameSpan.textContent = item.file_name;

      const tagContainer = document.createElement("div");
      tagContainer.className = "card-tags flex flex-wrap gap-1.5";

      const sortedTags = [...(item.tags || [])].sort((a, b) => a.localeCompare(b));
      sortedTags.forEach(t => {
        const pill = document.createElement("span");
        pill.className = "text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold rounded px-1.5 py-0.5 flex items-center gap-1";
        
        const tagText = document.createElement("span");
        tagText.textContent = t;

        const delBtn = document.createElement("button");
        delBtn.className = "tag-del text-zinc-500 hover:text-white font-bold ml-1";
        delBtn.textContent = "✕";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          if (window.removeSpecificTag) window.removeSpecificTag(id, item.relative_path, t);
        };

        pill.appendChild(tagText);
        pill.appendChild(delBtn);
        tagContainer.appendChild(pill);
      });

      info.appendChild(nameSpan);
      info.appendChild(tagContainer);
      card.appendChild(info);

      card.onclick = (e) => {
        if (e.target.closest(".select-btn") || e.target.closest(".tag-del")) return;
        if (typeof isSelectMode !== "undefined" && isSelectMode) toggleSelect(item.relative_path);
        else openInspector(globalIdx);
      };

      gridEl.appendChild(card);
    });
  }

  if (prevPageBtn) prevPageBtn.onclick = (e) => {
    e.stopPropagation();
    if (page > 1) {
      page--;
      renderGrid();
      root.querySelector(".ws-grid-container").scrollTop = 0;
    }
  };

  if (nextPageBtn) nextPageBtn.onclick = (e) => {
    e.stopPropagation();
    const limit = (typeof pageSize !== "undefined") ? pageSize : 100;
    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (page < totalPages) {
      page++;
      renderGrid();
      root.querySelector(".ws-grid-container").scrollTop = 0;
    }
  };

  function openInspector(idx) {
    if (filtered.length === 0) return;
    currentIndex = Math.max(0, Math.min(idx, filtered.length - 1));
    isInspectMode = true;
    inspectorEl.classList.remove("hidden");
    if (inspectBtn) {
      inspectBtn.innerHTML = "<span>↩ Return to Grid</span>";
      inspectBtn.classList.replace("text-sky-400", "text-rose-400");
    }
    if (pzInstance) pzInstance.reset();
    renderInspector();
  }

  function closeInspector() {
    isInspectMode = false;
    inspectorEl.classList.add("hidden");
    inspectedImg.src = "";
    if (inspectedVideo) {
      inspectedVideo.pause();
      inspectedVideo.src = "";
      inspectedVideo.dataset.loadedSrc = "";
    }
    videoStage.classList.add("hidden");
    videoControls.classList.add("hidden");
    if (inspectBtn) {
      inspectBtn.innerHTML = "<span>🖼</span> <span>Inspect</span>";
      inspectBtn.classList.replace("text-rose-400", "text-sky-400");
    }
    if (pzInstance) pzInstance.reset();
    if (window.mainTagDock) window.mainTagDock.render([]);
    if (typeof syncGeminiReferenceUI === 'function') syncGeminiReferenceUI();
  }

  function renderInspector() {
    if (filtered.length === 0) {
      closeInspector();
      return;
    }
    const item = filtered[currentIndex];
    const isVid = isVideoFile(item.file_name);
    const nextSrc = `/api/image?dir=${encodeURIComponent(dir)}&file=${encodeURIComponent(item.relative_path)}`;

    if (isVid) {
      inspectedImg.classList.add("hidden");
      videoStage.classList.remove("hidden");
      videoControls.classList.remove("hidden");
      
      if (inspectedVideo.dataset.loadedSrc !== nextSrc) {
        inspectedVideo.dataset.loadedSrc = nextSrc;
        vidSeek.value = 0;
        vidTime.textContent = "0:00 / 0:00";
        inspectedVideo.src = nextSrc;
        inspectedVideo.load();
        inspectedVideo.playbackRate = playbackSpeed;
        inspectedVideo.play().then(() => {
          inspectedVideo.playbackRate = playbackSpeed;
          vidPlayBtn.innerHTML = "<span>⏸</span> <span class=\"ws-vid-play-label\">Pause</span>";
        }).catch(() => {
          vidPlayBtn.innerHTML = "<span>▶</span> <span class=\"ws-vid-play-label\">Play</span>";
        });
      }
    } else {
      if (!inspectedVideo.paused) inspectedVideo.pause();
      inspectedVideo.dataset.loadedSrc = "";
      videoStage.classList.add("hidden");
      videoControls.classList.add("hidden");
      inspectedImg.classList.remove("hidden");
      if (inspectedImg.src !== nextSrc) {
        inspectedImg.src = nextSrc;
      }
    }

    if (fileNameEl) fileNameEl.textContent = item.file_name;
    updateCounter();

    if (itemTagsEl) {
      itemTagsEl.innerHTML = "";
      const sortedTags = [...(item.tags || [])].sort((a, b) => a.localeCompare(b));
      sortedTags.forEach(t => {
        const chip = document.createElement("span");
        chip.className = "text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 flex items-center gap-2 font-bold shadow-sm";
        
        const tagText = document.createElement("span");
        tagText.textContent = t;

        const delBtn = document.createElement("button");
        delBtn.className = "text-zinc-500 hover:text-white";
        delBtn.textContent = "✕";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          if (window.removeSpecificTag) window.removeSpecificTag(id, item.relative_path, t);
        };

        chip.appendChild(tagText);
        chip.appendChild(delBtn);
        itemTagsEl.appendChild(chip);
      });
    }

    renderFilmstrip();
    if (window.mainTagDock) window.mainTagDock.render(item.tags || []);
    if (typeof syncGeminiReferenceUI === 'function') syncGeminiReferenceUI();
  }

  function renderFilmstrip() {
    const bar = root.querySelector(".ws-filmstrip-bar");
    if (!bar) return;
    bar.innerHTML = "";
    const total = filtered.length;
    if (total <= 1) return;

    for (let offset = -2; offset <= 2; offset++) {
      const targetIdx = (currentIndex + offset + total) % total;
      const targetItem = filtered[targetIdx];

      const thumbBtn = document.createElement("button");
      const isCurrent = offset === 0;

      thumbBtn.className = `h-14 w-14 rounded-lg overflow-hidden border shrink-0 transition ${
        isCurrent ? "border-rose-500 ring-2 ring-rose-500/60 scale-105 shadow-xl" : "border-zinc-800 opacity-60 hover:opacity-100"
      }`;

      const thumbImg = document.createElement("img");
      thumbImg.src = `/api/thumbnail?dir=${encodeURIComponent(dir)}&file=${encodeURIComponent(targetItem.relative_path)}`;
      thumbImg.loading = "lazy";
      thumbImg.className = "h-full w-full object-cover";

      thumbBtn.appendChild(thumbImg);
      thumbBtn.onclick = (e) => {
        e.stopPropagation();
        currentIndex = targetIdx;
        if (pzInstance) pzInstance.reset();
        renderInspector();
      };

      bar.appendChild(thumbBtn);
    }
  }

  function navigate(delta, fromSync = false) {
    if (filtered.length === 0) return;
    currentIndex = (currentIndex + delta + filtered.length) % filtered.length;
    if (pzInstance) pzInstance.reset();
    renderInspector();
    if (!fromSync && window.onSyncStep) {
      window.onSyncStep(id, delta);
    }
  }

  function toggleSelect(rel) {
    if (selected.has(rel)) selected.delete(rel);
    else selected.add(rel);
    syncGlobalSelection();
    renderGrid();
  }

  function selectAll() {
    filtered.forEach(item => selected.add(item.relative_path));
    syncGlobalSelection();
    renderGrid();
  }

  function clearSelection() {
    selected.clear();
    syncGlobalSelection();
    renderGrid();
  }

  function syncGlobalSelection() {
    if (selectCountBtn) {
      if (selected.size > 0) {
        if (selectCountText) selectCountText.textContent = `${selected.size} Selected`;
        selectCountBtn.classList.remove("hidden");
      } else {
        selectCountBtn.classList.add("hidden");
      }
    }
    if (typeof syncGeminiReferenceUI === 'function') syncGeminiReferenceUI();
  }

  if (selectCountBtn) selectCountBtn.onclick = (e) => { e.stopPropagation(); clearSelection(); };

  function updateCounter() {
    if (counterEl) counterEl.textContent = `${filtered.length > 0 ? currentIndex + 1 : 0} / ${filtered.length}`;
  }

  if (restoreJunkBtn) {
    restoreJunkBtn.onclick = async () => {
      let targets = Array.from(selected);
      if (targets.length === 0 && isInspectMode && filtered[currentIndex]) {
        targets = [filtered[currentIndex].relative_path];
      }
      if (targets.length === 0) {
        if (typeof showToast === "function") showToast("Select files in Junk to restore");
        return;
      }

      const parentDir = dir.replace(/[\\/]\.junk$/, "") || "/";
      try {
        const res = await fetch("/api/files/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dir: dir, dest_subfolder: parentDir, relative_paths: targets })
        });
        const data = await res.json();
        if (typeof showToast === "function") showToast(`Restored ${data.moved} files to ${parentDir}`);
        await setDirectory(dir);
      } catch (e) {
        if (typeof showToast === "function") showToast("Restore failed: " + e.message);
      }
    };
  }

  if (aiStudioBtn) {
    aiStudioBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof toggleGeminiStudio === "function") toggleGeminiStudio();
    };
  }

  if (inspectBtn) {
    inspectBtn.onclick = () => {
      if (isInspectMode) closeInspector();
      else openInspector(currentIndex);
    };
  }

  if (closeInspectorBtn) closeInspectorBtn.onclick = () => closeInspector();
  if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); navigate(-1); };
  if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); navigate(1); };

  root.addEventListener("mousedown", () => {
    if (onFocusChange) onFocusChange(id);
  });

  const undoBtn = root.querySelector(".ws-undo-btn");
  if (undoBtn) {
    undoBtn.onclick = async (e) => {
      e.stopPropagation();
      if (window.executeUndo) await window.executeUndo();
    };
  }

  return {
    id,
    setDirectory,
    getDirectory: () => dir,
    getEntries: () => entries,
    getFiltered: () => filtered,
    getSelected: () => Array.from(selected),
    getState: () => ({ currentIndex, isInspectMode }),
    selectAll,
    clearSelection,
    getCurrentItem: () => filtered[currentIndex],
    navigate,
    closeInspector,
    applyFilters,
    renderGrid,
    setActiveHighlight,
    toggleSplitModeUI,
    getVideoPlayer: () => isInspectMode && !videoStage.classList.contains("hidden") ? inspectedVideo : null,
    toggleVideoPlay,
    stopVideo,
    skipVideo: (direction) => skipVideo(direction * skipInterval),
    toggleFullscreen,
    setSort: (mode) => {
      localSort = mode;
      if (localSortSelect) localSortSelect.value = mode;
      applyFilters();
    },
    setSortTag: (tagVal) => {
      globalSortTag = (tagVal || "").trim().toLowerCase();
      applyFilters();
    },
    setGridDensity: (mode) => { gridEl.className = `ws-grid grid grid-${mode} gap-4`; },
    applyTags: async (tags) => {
      const targetRels = selected.size > 0 
        ? Array.from(selected) 
        : (isInspectMode && filtered[currentIndex] ? [filtered[currentIndex].relative_path] : []);

      if (targetRels.length === 0) {
        if (typeof showToast === "function") showToast("Select photos or inspect an item first to add tags");
        return;
      }

      targetRels.forEach(rel => {
        const item = entries.find(e => e.relative_path === rel);
        if (item) item.tags = Array.from(new Set([...(item.tags || []), ...tags]));
      });

      renderGrid();
      if (isInspectMode) renderInspector();
      if (typeof showToast === "function") showToast(`Tagged (${tags.join(", ")})`);
      if (typeof setLastAction === "function") setLastAction({ type: 'tag_add', dir, relative_paths: targetRels, tags });

      await fetch("/api/tags/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir, relative_paths: targetRels, tags })
      }).catch(e => console.error(e));
    },
    removeTag: async (tag) => {
      if (!isInspectMode || !filtered[currentIndex]) return;
      const current = filtered[currentIndex];
      current.tags = (current.tags || []).filter(t => t !== tag);
      renderGrid();
      renderInspector();

      await fetch("/api/tags/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir, relative_path: current.relative_path, tag })
      }).catch(e => console.error(e));
    },
    removeSpecificTag: async (relPath, tag) => {
      const item = entries.find(e => e.relative_path === relPath);
      if (item) {
        item.tags = (item.tags || []).filter(t => t !== tag);
        renderGrid();
        if (isInspectMode && filtered[currentIndex]?.relative_path === relPath) {
          renderInspector();
        }
      }
      await fetch("/api/tags/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir, relative_path: relPath, tag })
      }).catch(e => console.error(e));
    },
    removeTagsBulk: async (tags) => {
      const targetRels = selected.size > 0 
        ? Array.from(selected) 
        : (isInspectMode && filtered[currentIndex] ? [filtered[currentIndex].relative_path] : []);

      if (targetRels.length === 0) return;

      targetRels.forEach(rel => {
        const item = entries.find(e => e.relative_path === rel);
        if (item && item.tags) {
          item.tags = item.tags.filter(t => !tags.includes(t.toLowerCase()));
        }
      });

      renderGrid();
      if (isInspectMode) renderInspector();
      if (typeof showToast === "function") showToast(`Removed tags (${tags.join(", ")})`);
      if (typeof setLastAction === "function") setLastAction({ type: 'tag_remove', dir, relative_paths: targetRels, tags });

      await fetch("/api/tags/remove-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir, relative_paths: targetRels, tags })
      }).catch(e => console.error(e));
    },
    panZoom: pzInstance
  };
}
