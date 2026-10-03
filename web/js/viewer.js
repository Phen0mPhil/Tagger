// Isolated Viewer & Deck Slideshow Engine

let currentDeckList = [];
let deckCursor = 0;
let slideshowInterval = null;
let currentSpeed = 3500;
let isShuffled = false;
let lbPanZoom = null;
let savedScrollY = 0;

function ensureLightboxPanZoom() {
  if (!lbPanZoom) {
    const container = document.getElementById("lbImageContainer");
    const img = document.getElementById("lbImage");
    if (container && img) {
      lbPanZoom = createPanZoom(container, img);
    }
  }
}

// Single Inspection Mode (via Grid click) -> Populate FULL folder view
function openLightbox(relPath) {
  if (!filteredEntries || filteredEntries.length === 0) return;
  
  // Save active scroll position
  savedScrollY = window.scrollY;

  // Populate deck with ALL filtered entries from current folder
  currentDeckList = filteredEntries.map(e => ({
    dir: currentDir,
    relative_path: e.relative_path,
    file_name: e.file_name
  }));

  const idx = currentDeckList.findIndex(e => e.relative_path === relPath);
  deckCursor = idx !== -1 ? idx : 0;

  launchViewerModal(false);
}

// Sequence Mode (via Deck)
function startDeckSlideshow() {
  if (!deck || deck.length === 0) {
    showToast("Deck is empty. Add photos with [+ Deck] first.");
    return;
  }

  savedScrollY = window.scrollY;
  currentDeckList = isShuffled ? shuffleArray([...deck]) : [...deck];
  deckCursor = 0;

  launchViewerModal(true);
  playSlideshowLoop();
}

function launchViewerModal(isSlideshowMode) {
  const lb = document.getElementById("lightbox");
  lb.classList.remove("hidden");

  // Keep layout intact to preserve scroll position, but hide visually from paint
  const mainArea = document.getElementById("mainGridArea");
  if (mainArea) mainArea.style.visibility = "hidden";

  const controls = document.getElementById("deckSlideshowControls");
  if (controls) controls.classList.toggle("hidden", !isSlideshowMode);

  ensureLightboxPanZoom();
  if (lbPanZoom) lbPanZoom.reset();
  renderCurrentSlide();
}

function closeLightbox() {
  stopSlideshow();
  const lb = document.getElementById("lightbox");
  lb.classList.add("hidden");

  // Restore grid visibility and scroll position
  const mainArea = document.getElementById("mainGridArea");
  if (mainArea) {
    mainArea.style.visibility = "";
    window.scrollTo({ top: savedScrollY, behavior: "instant" });
  }

  const img = document.getElementById("lbImage");
  if (img) img.src = ""; // Purge GPU texture immediately

  if (lbPanZoom) lbPanZoom.reset();
}

function renderCurrentSlide() {
  if (currentDeckList.length === 0) {
    closeLightbox();
    return;
  }

  const item = currentDeckList[deckCursor];
  document.getElementById("lbCounter").textContent = `${deckCursor + 1} / ${currentDeckList.length}`;
  document.getElementById("lbFilename").textContent = item.file_name;

  const img = document.getElementById("lbImage");
  img.src = `/api/image?dir=${encodeURIComponent(item.dir)}&file=${encodeURIComponent(item.relative_path)}`;

  document.getElementById("lbSelectCheckbox").checked = selectedSet.has(item.relative_path);

  // Sync tags if item belongs to active directory
  const activeEntry = allEntries.find(e => e.relative_path === item.relative_path);
  renderLightboxTags(activeEntry ? activeEntry.tags : []);
}

function renderLightboxTags(tags) {
  const tagsContainer = document.getElementById("lbTags");
  tagsContainer.innerHTML = "";
  (tags || []).forEach(t => {
    const pill = document.createElement("span");
    pill.className = "text-xs bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-0.5 flex items-center gap-1.5";
    pill.innerHTML = `<span>${t}</span><button class="text-zinc-500 hover:text-white" onclick="removeTagFromLightbox('${t}')">✕</button>`;
    tagsContainer.appendChild(pill);
  });
}

function navigateLightbox(delta) {
  if (currentDeckList.length === 0) return;
  deckCursor = (deckCursor + delta + currentDeckList.length) % currentDeckList.length;
  if (lbPanZoom) lbPanZoom.reset();
  renderCurrentSlide();
}

// In-Viewer Live Pruning (Del key or button)
function evictCurrentSlideFromDeck() {
  if (currentDeckList.length === 0) return;
  const currentItem = currentDeckList[deckCursor];

  // Remove from master deck if matching
  const masterIdx = deck.findIndex(d => d.dir === currentItem.dir && d.relative_path === currentItem.relative_path);
  if (masterIdx !== -1) {
    removeDeckItem(masterIdx);
  }

  // Remove from active playback deck
  currentDeckList.splice(deckCursor, 1);
  if (deckCursor >= currentDeckList.length) {
    deckCursor = 0;
  }

  showToast("Removed from Deck");
  if (currentDeckList.length === 0) {
    closeLightbox();
  } else {
    renderCurrentSlide();
  }
}

// Timer & Speed Engine
function setSlideshowSpeed(ms) {
  currentSpeed = ms;
  document.querySelectorAll(".speedBtn").forEach(btn => {
    btn.classList.toggle("bg-sky-600", parseInt(btn.dataset.speed, 10) === ms);
    btn.classList.toggle("text-white", parseInt(btn.dataset.speed, 10) === ms);
    btn.classList.toggle("bg-zinc-900", parseInt(btn.dataset.speed, 10) !== ms);
    btn.classList.toggle("text-zinc-400", parseInt(btn.dataset.speed, 10) !== ms);
  });

  if (slideshowInterval) {
    playSlideshowLoop();
  }
}

function toggleShuffle() {
  isShuffled = !isShuffled;
  const btn = document.getElementById("shuffleToggleBtn");
  btn.classList.toggle("bg-purple-600", isShuffled);
  btn.classList.toggle("text-white", isShuffled);
  btn.classList.toggle("bg-zinc-900", !isShuffled);
  btn.classList.toggle("text-zinc-400", !isShuffled);

  if (isShuffled) {
    currentDeckList = shuffleArray([...currentDeckList]);
    deckCursor = 0;
    renderCurrentSlide();
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function playSlideshowLoop() {
  clearInterval(slideshowInterval);
  document.getElementById("lbSlideshowToggle").textContent = "⏸ Pause";
  slideshowInterval = setInterval(() => {
    navigateLightbox(1);
  }, currentSpeed);
}

function stopSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
    const btn = document.getElementById("lbSlideshowToggle");
    if (btn) btn.textContent = "▶ Play";
  }
}

function toggleSlideshowPlayback() {
  if (slideshowInterval) {
    stopSlideshow();
  } else {
    playSlideshowLoop();
  }
}

function handleLightboxClick(e) {
  if (e.target.id === "lbImage") return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  if (clickX < rect.width / 2) {
    navigateLightbox(-1);
  } else {
    navigateLightbox(1);
  }
}

function toggleSelectFromLightbox() {
  const item = currentDeckList[deckCursor];
  if (!item) return;
  toggleSelect(item.relative_path);
  document.getElementById("lbSelectCheckbox").checked = selectedSet.has(item.relative_path);
}

// Targeted in-place tag update (Zero page jump)
async function addLightboxTag() {
  const inp = document.getElementById("lbAddTagInput");
  const val = inp.value.trim().toLowerCase();
  if (!val) return;
  const item = currentDeckList[deckCursor];
  if (!item) return;

  const tags = val.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  await fetch("/api/tags/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dir: item.dir, relative_paths: [item.relative_path], tags })
  });

  inp.value = "";
  
  // Update internal catalog in memory directly without rerendering grid
  const target = allEntries.find(e => e.relative_path === item.relative_path);
  if (target) {
    target.tags = Array.from(new Set([...(target.tags || []), ...tags]));
    renderLightboxTags(target.tags);
    updateCardTagsInGrid(item.relative_path, target.tags);
  }
}

async function removeTagFromLightbox(tag) {
  const item = currentDeckList[deckCursor];
  if (!item) return;

  await fetch("/api/tags/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dir: item.dir, relative_path: item.relative_path, tag })
  });

  const target = allEntries.find(e => e.relative_path === item.relative_path);
  if (target) {
    target.tags = (target.tags || []).filter(t => t !== tag);
    renderLightboxTags(target.tags);
    updateCardTagsInGrid(item.relative_path, target.tags);
  }
}
