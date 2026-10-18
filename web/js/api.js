async function pickFolder() {
  showToast("Opening folder picker...", 3000);
  try {
    const res = await fetch("/api/pick-folder", { method: "POST" });
    if (!res.ok) {
      const errText = await res.text();
      showToast("Picker error: " + errText.substring(0, 60), 5000);
      return;
    }
    const data = await res.json();
    if (data.path && data.path.trim()) {
      const picked = data.path.trim();
      currentDir = picked;

      const ws = (typeof window.getActiveWorkspace === "function") 
        ? window.getActiveWorkspace() 
        : (window.primaryWorkspace || null);

      if (!ws) {
        throw new Error("Workspace not initialized yet. Please wait a moment.");
      }

      await ws.setDirectory(picked);
      showToast("Directory loaded", 3000);
    }
  } catch (err) {
    showToast("UI Error: " + err.message, 10000);
  }
}

async function sweepTagToFolder(tag, destSubfolder) {
  if (!tag) return;
  const activeWs = window.getActiveWorkspace();
  if (!activeWs) {
    showToast("Workspace not initialized");
    return;
  }

  const activeDir = activeWs.getDirectory();
  if (!activeDir) return;

  try {
    const res = await fetch(`/api/entries?dir=${encodeURIComponent(activeDir)}`);
    if (!res.ok) return;
    const all = await res.json();
    const targetPaths = all.filter(e => (e.tags || []).map(t => String(t).toLowerCase()).includes(String(tag).toLowerCase())).map(e => e.relative_path);

    if (targetPaths.length === 0) {
      showToast(`No photos found tagged '${tag}' to sweep`);
      return;
    }

    showToast(`Sweeping ${targetPaths.length} photos tagged '${tag}'...`);
    const moveRes = await fetch("/api/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dir: activeDir,
        dest_subfolder: destSubfolder,
        relative_paths: targetPaths
      })
    });
    if (!moveRes.ok) throw new Error(await moveRes.text());
    const data = await moveRes.json();
    showToast(`Swept ${data.moved} photos into ${destSubfolder}`);
    if (typeof rescanWorkspaces === "function") {
      await rescanWorkspaces();
    } else {
      await activeWs.setDirectory(activeDir);
    }
  } catch (err) {
    showToast("Sweep failed: " + err.message);
  }
}

async function exitApp() {
  if (confirm("Shut down the tagger server?")) {
    await fetch("/api/shutdown", { method: "POST" });
    window.close();
  }
}
