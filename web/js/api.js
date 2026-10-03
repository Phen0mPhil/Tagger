let mainNav = null;

function ensureMainNav() {
  if (!mainNav) {
    mainNav = createDirectoryNavigator({
      breadcrumbEl: document.getElementById("breadcrumbBar"),
      subfolderEl: document.getElementById("subfolderBar"),
      onNavigate: (newPath) => switchDirectory(newPath)
    });
  }
}

async function pickFolder() {
  showToast("Opening folder picker...");
  try {
    const res = await fetch("/api/pick-folder", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.path && data.path.trim()) {
        currentDir = data.path.trim();
        document.getElementById("dirInput").value = currentDir;
        await triggerScan();
        return;
      }
    }
  } catch (err) {
    console.warn("Picker fallback triggered:", err);
  }

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
    
    selectedSet.clear();
    await loadEntries(false);
    await refreshBrowseNav(path);
    showToast("Scan complete");
  } catch (err) {
    showToast("Scan error: " + err.message);
  }
}

async function loadEntries(preserveSelection = true) {
  if (!currentDir) return;
  try {
    const res = await fetch(`/api/entries?dir=${encodeURIComponent(currentDir)}`);
    if (!res.ok) throw new Error(await res.text());
    allEntries = await res.json();
    if (!preserveSelection) {
      selectedSet.clear();
    }
    applyFilters();
  } catch (err) {
    showToast("Failed to load photos: " + err.message);
  }
}

async function refreshBrowseNav(targetPath) {
  ensureMainNav();
  if (mainNav) {
    await mainNav.update(targetPath);
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
    
    await loadEntries(true);
    showToast(`Tagged ${relPaths.length} photos (${tags.join(", ")})`);
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
    await loadEntries(true);
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
