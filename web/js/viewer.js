function startSlideshow() {
if (selectedSet.size > 0) {
slideshowPool = filteredEntries.filter(e => selectedSet.has(e.relative_path));
} else {
slideshowPool = [...filteredEntries];
}

if (slideshowPool.length === 0) {
showToast("No images available for slideshow");
return;
}

lbIndex = 0;
openLightboxWithIndex(0);
playSlideshowLoop();
}

function playSlideshowLoop() {
clearInterval(slideshowInterval);
document.getElementById("lbSlideshowToggle").textContent = "⏸ Pause";
slideshowInterval = setInterval(() => {
navigateLightbox(1);
}, 3000);
}

function toggleSlideshowPlayback() {
if (slideshowInterval) {
clearInterval(slideshowInterval);
slideshowInterval = null;
document.getElementById("lbSlideshowToggle").textContent = "▶ Play";
} else {
playSlideshowLoop();
}
}

function openLightbox(rel) {
slideshowPool = [...filteredEntries];
const idx = slideshowPool.findIndex(e => e.relative_path === rel);
openLightboxWithIndex(idx !== -1 ? idx : 0);
}

function openLightboxWithIndex(index) {
lbIndex = index;
const item = slideshowPool[lbIndex];
if (!item) return;

const lb = document.getElementById("lightbox");
lb.classList.remove("hidden");

document.getElementById("lbCounter").textContent = ${lbIndex + 1} / ${slideshowPool.length};
document.getElementById("lbFilename").textContent = item.file_name;
document.getElementById("lbImage").src = /api/image?file=${encodeURIComponent(item.relative_path)};
document.getElementById("lbSelectCheckbox").checked = selectedSet.has(item.relative_path);

renderLightboxTags(item);
}

function renderLightboxTags(item) {
const container = document.getElementById("lbTags");
container.innerHTML = "";
(item.tags || []).forEach(t => {
const pill = document.createElement("span");
pill.className = "text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-2 py-0.5 flex items-center gap-1.5";
pill.innerHTML = <span>${t}</span><button class="text-zinc-500 hover:text-white" onclick="removeLightboxTag('${t}')">✕</button>;
container.appendChild(pill);
});
}

function navigateLightbox(delta) {
lbIndex = (lbIndex + delta + slideshowPool.length) % slideshowPool.length;
openLightboxWithIndex(lbIndex);
}

function closeLightbox() {
clearInterval(slideshowInterval);
slideshowInterval = null;
document.getElementById("lightbox").classList.add("hidden");
renderGrid();
}

function handleLightboxClick(event) {
if (event.target.id === "lightbox" || event.target.tagName === "DIV") {
closeLightbox();
}
}

function toggleSelectFromLightbox() {
const item = slideshowPool[lbIndex];
if (!item) return;
toggleSelect(item.relative_path);
}

async function addLightboxTag() {
const input = document.getElementById("lbAddTagInput");
const val = input.value.trim();
if (!val) return;
const item = slideshowPool[lbIndex];
if (!item) return;

await fetch("/api/tags/add", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ relative_paths: [item.relative_path], tags: [val] })
});

input.value = "";
await loadEntries();
const updated = allEntries.find(e => e.relative_path === item.relative_path);
if (updated) {
slideshowPool[lbIndex] = updated;
renderLightboxTags(updated);
}
}

async function removeLightboxTag(tag) {
const item = slideshowPool[lbIndex];
if (!item) return;

await fetch("/api/tags/remove", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ relative_path: item.relative_path, tag: tag })
});

await loadEntries();
const updated = allEntries.find(e => e.relative_path === item.relative_path);
if (updated) {
slideshowPool[lbIndex] = updated;
renderLightboxTags(updated);
}
}
