async function pickFolder() {
try {
const res = await fetch("/api/pick-folder", { method: "POST" });
const data = await res.json();
if (data.path) {
document.getElementById("dirInput").value = data.path;
triggerScan();
}
} catch (e) {
showToast("Folder selection canceled or unavailable");
}
}

async function triggerScan() {
const pathVal = document.getElementById("dirInput").value.trim();
const recVal = document.getElementById("recursiveCheck").checked;
if (!pathVal) return;

showToast("Scanning folder...");
try {
const res = await fetch("/api/scan", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ path: pathVal, recursive: recVal })
});

if (!res.ok) {
  const errText = await res.text();
  showToast("Scan Error: " + errText, 4000);
  return;
}

const info = await res.json();
currentDir = info.root_dir;
await refreshBrowseNav(currentDir);
await loadEntries();


} catch (e) {
showToast("Scan failed: " + e.message);
}
}

async function refreshBrowseNav(dir) {
if (!dir) return;
try {
const res = await fetch(/api/browse?dir=${encodeURIComponent(dir)});
if (!res.ok) return;
const data = await res.json();

// Render Breadcrumbs
const bBar = document.getElementById("breadcrumbBar");
bBar.innerHTML = `<span class="text-zinc-600">Path:</span>`;
const segments = data.current_path.split("/").filter(Boolean);
let cumulative = data.current_path.startsWith("/") ? "" : "";

segments.forEach((seg, idx) => {
  cumulative += (cumulative ? "/" : (data.current_path.startsWith("/") ? "/" : "")) + seg;
  const targetPath = cumulative;
  const btn = document.createElement("button");
  btn.className = "text-sky-400 hover:text-sky-300 font-mono hover:underline";
  btn.textContent = seg;
  btn.onclick = () => jumpToDirectory(targetPath);
  bBar.appendChild(btn);
  if (idx < segments.length - 1) {
    const sep = document.createElement("span");
    sep.className = "text-zinc-600";
    sep.textContent = "/";
    bBar.appendChild(sep);
  }
});

// Render Subfolder Hop Pills
const sBar = document.getElementById("subfolderBar");
sBar.innerHTML = "";
if (data.parent_path) {
  const upBtn = document.createElement("button");
  upBtn.className = "px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded text-[11px]";
  upBtn.textContent = "⤴ Up";
  upBtn.onclick = () => jumpToDirectory(data.parent_path);
  sBar.appendChild(upBtn);
}

data.subfolders.forEach(sub => {
  const btn = document.createElement("button");
  btn.className = "px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded text-[11px] flex items-center gap-1";
  btn.innerHTML = `📁 <span>${sub.Name}</span>`;
  btn.onclick = () => jumpToDirectory(sub.Path);
  sBar.appendChild(btn);
});


} catch (e) {
console.error("Browse nav error:", e);
}
}

function jumpToDirectory(path) {
document.getElementById("dirInput").value = path;
triggerScan();
}

async function loadEntries() {
try {
const res = await fetch("/api/entries");
allEntries = await res.json();
applyFilters();
} catch (e) {
showToast("Failed to load catalog entries");
}
}

async function applyTagBatch(tags) {
if (selectedSet.size === 0) {
showToast("Select at least 1 photo first");
return;
}

const paths = Array.from(selectedSet);
try {
const res = await fetch("/api/tags/add", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ relative_paths: paths, tags: tags })
});

if (res.ok) {
  showToast(`Tagged ${paths.length} photos`);
  await loadEntries();
} else {
  showToast("Failed to apply tags", 3000);
}


} catch (e) {
showToast("Tag error: " + e.message);
}
}

async function applyCustomTagInput() {
const val = document.getElementById("customTagInput").value.trim();
if (!val) return;
const tags = val.split(",").map(t => t.trim()).filter(Boolean);
await applyTagBatch(tags);
document.getElementById("customTagInput").value = "";
}

async function removeTag(rel, tag) {
try {
const res = await fetch("/api/tags/remove", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ relative_path: rel, tag: tag })
});
if (res.ok) {
await loadEntries();
}
} catch (e) {
console.error("Remove tag error:", e);
}
}

async function exitApp() {
if (confirm("Close Photo Tagger backend server?")) {
try { await fetch("/api/shutdown"); } catch(e){}
window.close();
}
}
