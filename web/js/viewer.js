let currentDeckList = [];
let deckCursor = 0;
let slideshowInterval = null;
let currentSpeed = 3500;
let currentVideoPlayRate = 1.0;
let isShuffled = false;

function formatSlideTime(secs) {
  const m = Math.floor(secs / 60) || 0;
  const s = Math.floor(secs % 60) || 0;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function startDeckSlideshow() {
  if (!deck || deck.length === 0) {
    showToast("Playlist is empty. Select photos or videos first.");
    return;
  }

  currentDeckList = isShuffled ? shuffleArray([...deck]) : [...deck];
  deckCursor = 0;

  const modal = document.getElementById("slideshowModal");
  if (modal) modal.classList.remove("hidden");

  renderSlideshowSlide();
  playSlideshowLoop();
}

function closeSlideshowModal() {
  stopSlideshow();
  const modal = document.getElementById("slideshowModal");
  if (modal) modal.classList.add("hidden");
  
  const img = document.getElementById("ssImage");
  if (img) img.src = "";
  
  const vid = document.getElementById("ssVideo");
  if (vid) {
    vid.pause();
    vid.src = "";
    vid.onended = null;
    vid.ontimeupdate = null;
    vid.dataset.loadedSrc = "";
    vid.classList.add("hidden");
  }

  const progBar = document.getElementById("ssVideoProgressBar");
  if (progBar) progBar.classList.add("hidden");
}

function renderSlideshowSlide() {
  if (currentDeckList.length === 0) {
    closeSlideshowModal();
    return;
  }

  const item = currentDeckList[deckCursor];
  document.getElementById("ssCounter").textContent = `${deckCursor + 1} / ${currentDeckList.length}`;
  document.getElementById("ssFilename").textContent = item.file_name;

  const img = document.getElementById("ssImage");
  const vid = document.getElementById("ssVideo");
  const photoSpeedGroup = document.getElementById("ssPhotoSpeedGroup");
  const videoSpeedGroup = document.getElementById("ssVideoSpeedGroup");
  const progBar = document.getElementById("ssVideoProgressBar");
  const seekEl = document.getElementById("ssVideoSeek");
  const timeEl = document.getElementById("ssVideoTime");

  const src = `/api/image?dir=${encodeURIComponent(item.dir)}&file=${encodeURIComponent(item.relative_path)}`;

  if (isVideoFile(item.file_name)) {
    img.classList.add("hidden");
    img.src = "";
    vid.classList.remove("hidden");

    if (photoSpeedGroup) photoSpeedGroup.classList.add("hidden");
    if (videoSpeedGroup) videoSpeedGroup.classList.remove("hidden");
    if (progBar) progBar.classList.remove("hidden");

    vid.loop = currentDeckList.length === 1;
    vid.onended = () => {
      if (slideshowInterval) navigateSlideshow(1);
    };
    vid.ontimeupdate = () => {
      if (!vid.duration) return;
      const pct = (vid.currentTime / vid.duration) * 100;
      if (seekEl) seekEl.value = pct;
      if (timeEl) timeEl.textContent = `${formatSlideTime(vid.currentTime)} / ${formatSlideTime(vid.duration)}`;
    };
    if (seekEl) {
      seekEl.oninput = (e) => {
        e.stopPropagation();
        if (!vid.duration) return;
        vid.currentTime = (seekEl.value / 100) * vid.duration;
      };
    }

    if (vid.dataset.loadedSrc !== src) {
      vid.dataset.loadedSrc = src;
      if (seekEl) seekEl.value = 0;
      if (timeEl) timeEl.textContent = "0:00 / 0:00";
      vid.src = src;
      vid.load();
      vid.playbackRate = currentVideoPlayRate;
      vid.play().then(() => {
        vid.playbackRate = currentVideoPlayRate;
      }).catch(() => {});
    } else {
      vid.playbackRate = currentVideoPlayRate;
    }
  } else {
    vid.pause();
    vid.onended = null;
    vid.ontimeupdate = null;
    vid.dataset.loadedSrc = "";
    vid.classList.add("hidden");
    vid.src = "";

    if (videoSpeedGroup) videoSpeedGroup.classList.add("hidden");
    if (photoSpeedGroup) photoSpeedGroup.classList.remove("hidden");
    if (progBar) progBar.classList.add("hidden");

    img.classList.remove("hidden");
    img.src = src;
  }
}

function navigateSlideshow(delta) {
  if (currentDeckList.length === 0) return;
  deckCursor = (deckCursor + delta + currentDeckList.length) % currentDeckList.length;
  renderSlideshowSlide();
}

function setSlideshowSpeed(ms) {
  currentSpeed = ms;
  document.querySelectorAll(".speedBtn").forEach(btn => {
    const active = parseInt(btn.dataset.speed, 10) === ms;
    btn.classList.toggle("bg-sky-600", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("bg-zinc-900", !active);
    btn.classList.toggle("text-zinc-400", !active);
  });

  if (slideshowInterval) playSlideshowLoop();
}

function setSlideshowVideoSpeed(rate) {
  currentVideoPlayRate = rate;
  const vid = document.getElementById("ssVideo");
  if (vid) vid.playbackRate = rate;

  document.querySelectorAll(".ssVidRateBtn").forEach(btn => {
    const active = parseFloat(btn.dataset.rate) === rate;
    btn.classList.toggle("bg-rose-600", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("bg-zinc-900", !active);
    btn.classList.toggle("text-zinc-400", !active);
  });
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
    renderSlideshowSlide();
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
  const btn = document.getElementById("ssToggleBtn");
  if (btn) btn.textContent = "⏸ Pause";
  const vid = document.getElementById("ssVideo");
  if (vid && !vid.classList.contains("hidden") && vid.paused) {
    vid.playbackRate = currentVideoPlayRate;
    vid.play().catch(() => {});
  }
  slideshowInterval = setInterval(() => {
    const activeVid = document.getElementById("ssVideo");
    if (activeVid && !activeVid.classList.contains("hidden")) return;
    navigateSlideshow(1);
  }, currentSpeed);
}

function stopSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  const btn = document.getElementById("ssToggleBtn");
  if (btn) btn.textContent = "▶ Play";
  const vid = document.getElementById("ssVideo");
  if (vid && !vid.classList.contains("hidden")) {
    vid.pause();
  }
}

function toggleSlideshowPlayback() {
  if (slideshowInterval) stopSlideshow();
  else playSlideshowLoop();
}

function handleSlideshowClick(e) {
  if (e.target.id === "ssImage" || e.target.id === "ssVideo" || e.target.closest("#ssVideoProgressBar")) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  if (clickX < rect.width / 2) navigateSlideshow(-1);
  else navigateSlideshow(1);
}
