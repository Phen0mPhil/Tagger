async function pickFolder() {
  showToast("Opening folder picker...");
  try {
    const res = await fetch("/api/pick-folder", { method: "POST" });
    if (!res.ok) throw new Error("Folder dialog canceled or blocked");
    const data = await res.json();
    if (data.path) {
      currentDir = data.path;
      document.getElementById("dirInput").value = data.path;
      await triggerScan();
      return;
    }
  } catch (err) {
    console.warn("Picker fallback triggered:", err);
  }

  // Graceful fallback: If Windows/antivirus suppresses the dialog, prompt for paste
  const manual = prompt("Paste your folder path here (e.g. D:\\Weddings):", currentDir || "");
  if (manual && manual.trim()) {
    currentDir = manual.trim();
    document.getElementById("dirInput").value = currentDir;
    await triggerScan();
  }
}

async function triggerScan() {
  const inputEl = document.getElementById("dirInput");
  const path = (inputEl.value || currentDir || "").trim();
  if (!path) {
    showToast("Please paste or choose a folder path first");
    inputEl.focus();
    return;
  }
  currentDir = path;
  inputEl.value = path;
  const recursive = document.getElementById("recursiveCheck").checked;

  showToast("Scanning photos...");
  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, recursive })
    });
    if (!res.ok) throw new Error(await res.text());
    
    await loadEntries();
    await refreshBrowseNav(path);
    showToast("Scan complete");
  } catch (err) {
    showToast("Scan error: " + err.message);
  }
}

async function loadEntries() {
  if (!currentDir) return;
  try {
    const res = await fetch(`/api/entries?dir=${encodeURIComponent(currentDir)}`);
    if (!res.ok) throw new Error(await res.text());
    allEntries = await res.json();
    selectedSet.clear();
    applyFilters();
  } catch (err) {
    showToast("Failed to load photos: " + err.message);
  }
}

async function refreshBrowseNav(targetPath) {
  if (!targetPath) return;
  try {
    const res = await fetch(`/api/browse?dir=${encodeURIComponent(targetPath)}`);
    if (!res.ok) return;
    const data = await res.json();

    const breadcrumb = document.getElementById("breadcrumbBar");
    breadcrumb.innerHTML = '<span class="text-zinc-500">Path:</span>';

    const parts = data.current_path.split("/").filter(Boolean);
    let accum = "";
    parts.forEach((p, idx) => {
      accum += (accum === "" && p.includes(":")) ? p : "/" + p;
      const hop = accum;
      const btn = document.createElement("button");
      btn.className = "hover:text-sky-400 underline font-mono text-zinc-300";
      btn.textContent = p;
      btn.onclick = () => switchDirectory(hop);
      breadcrumb.appendChild(btn);
      if (idx < parts.length - 1) {
        const slash = document.createElement("span");
        slash.className = "text-zinc-600";
        slash.textContent = "/";
        breadcrumb.appendChild(slash);
      }
    });

    const subBar = document.getElementById("subfolderBar");
    subBar.innerHTML = "";

    if (data.parent_path) {
      const up = document.createElement("button");
      up.className = "px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded text-[11px] font-medium";
      up.textContent = "⤴ Up";
      up.onclick = () => switchDirectory(data.parent_path);
      subBar.appendChild(up);
    }

    data.subfolders.forEach(sub => {
      const b = document.createElement("button");
      b.className = "px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded text-[11px] font-medium truncate max-w-[150px]";
      b.textContent = `📁 ${sub.name}`;
      b.onclick = () => switchDirectory(sub.path);
      subBar.appendChild(b);
    });
  } catch (err) {
    console.error(err);
  }
}

async function switchDirectory(newPath) {
  currentDir = newPath;
  document.getElementById("dirInput").value = newPath;
  await triggerScan();
}

async function applyTagBatch(tags) {
  if (selectedSet.size === 0) {
    showToast("No photos selected");
    return;
  }
  const relPaths = Array.from(selectedSet);
  try {
    const res = await fetch("/api/tags/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dir: currentDir, relative_paths: relPaths, tags })
    });
    if (!res.ok) throw new Error(await res.text());
    await loadEntries();
    showToast(`Tagged ${relPaths.length} photos`);
  } catch (err) {
    showToast("Error adding tags: " + err.message);
  }
}

async function removeTag(relPath, tag) {
  try {
    const res = await fetch("/api/tags/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dir: currentDir, relative_path: relPath, tag })
    });
    if (!res.ok) throw new Error(await res.text());
    await loadEntries();
  } catch (err) {
    showToast("Error removing tag: " + err.message);
  }
}

async function exitApp() {
  if (confirm("Shut down the tagger server?")) {
    await fetch("/api/shutdown", { method: "POST" });
    window.close();
  }
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2500);
}
