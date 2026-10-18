let isGeminiStudioOpen = false;
let wasSplitBeforeGemini = false;
let lastGeminiTextOutput = "";
let geminiSessionHistory = []; 
let isHistoryViewActive = false;
let pinnedSplitRef = null;

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function base64ToBlobUrl(b64, mimeType) {
  const byteCharacters = atob(b64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

function extractWorkspaceReferences(ws) {
  if (!ws) return { dir: "", paths: [] };
  const dir = ws.getDirectory();
  if (!dir) return { dir: "", paths: [] };

  const selected = ws.getSelected();
  if (selected && selected.length > 0) {
    return { dir, paths: [...selected] };
  }

  const state = ws.getState();
  const current = ws.getCurrentItem();
  if (state && state.isInspectMode && current && current.relative_path) {
    return { dir, paths: [current.relative_path] };
  }

  return { dir, paths: [] };
}

function getActiveGeminiReferences() {
  if (pinnedSplitRef && pinnedSplitRef.dir && pinnedSplitRef.paths && pinnedSplitRef.paths.length > 0) {
    return pinnedSplitRef;
  }

  const activeWs = (typeof window.getActiveWorkspace === "function")
    ? window.getActiveWorkspace()
    : window.primaryWorkspace;

  const activeRefs = extractWorkspaceReferences(activeWs);
  if (activeRefs.paths.length > 0) {
    return activeRefs;
  }

  if (activeWs !== window.primaryWorkspace && window.primaryWorkspace) {
    const primaryRefs = extractWorkspaceReferences(window.primaryWorkspace);
    if (primaryRefs.paths.length > 0) {
      return primaryRefs;
    }
  }

  return { dir: activeRefs.dir || (window.primaryWorkspace ? window.primaryWorkspace.getDirectory() : ""), paths: [] };
}

function syncGeminiReferenceUI(preservePinned = false) {
  if (!preservePinned) {
    pinnedSplitRef = null;
  }
  if (!isGeminiStudioOpen) return;
  const strip = document.getElementById("geminiRefStrip");
  if (!strip) return;

  const { dir, paths } = getActiveGeminiReferences();
  if (!dir || paths.length === 0) {
    strip.innerHTML = `<span class="text-xs font-mono text-zinc-500 italic">No reference selected. Inspect or check photos.</span>`;
    return;
  }

  strip.innerHTML = paths.map(rel => {
    const thumbUrl = `/api/thumbnail?dir=${encodeURIComponent(dir)}&file=${encodeURIComponent(rel)}`;
    const baseName = rel.split("/").pop();
    return `
      <div class="flex items-center gap-1.5 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 shrink-0 shadow-sm">
        <img src="${thumbUrl}" class="w-6 h-6 object-cover rounded border border-zinc-800" />
        <span class="text-xs font-mono text-zinc-200 max-w-[130px] truncate">${escapeHtml(baseName)}</span>
      </div>
    `;
  }).join("");
}

function updateKeyStatusUI() {
  const btn = document.getElementById("geminiKeyStatusBtn");
  if (!btn) return;
  const key = sessionStorage.getItem("gemini_api_key");
  if (key) {
    btn.className = "text-xs font-bold px-3 py-1.5 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-lg hover:bg-emerald-900 transition flex items-center gap-1.5 shadow-sm";
    btn.innerHTML = `<span>✓</span> <span>Key Active</span>`;
    btn.title = "Click to update or clear your Gemini API Key";
  } else {
    btn.className = "text-xs font-bold px-3 py-1.5 bg-amber-950 border border-amber-700 text-amber-300 rounded-lg hover:bg-amber-900 transition flex items-center gap-1.5 shadow-sm";
    btn.innerHTML = `<span>🔑</span> <span>Set Key</span>`;
    btn.title = "No active key in memory. Click to enter key.";
  }
}

function promptForApiKey() {
  const currentKey = sessionStorage.getItem("gemini_api_key") || "";
  const newKey = prompt("Enter Gemini API Key for this browser session (held in RAM only):", currentKey);
  if (newKey !== null) {
    const trimmed = newKey.trim();
    if (trimmed) {
      sessionStorage.setItem("gemini_api_key", trimmed);
      if (typeof showToast === "function") showToast("Gemini Key Accepted", 2500);
      updateKeyStatusUI();
      renderInitialStreamState();
    } else {
      sessionStorage.removeItem("gemini_api_key");
      if (typeof showToast === "function") showToast("Session API Key cleared", 2500);
      updateKeyStatusUI();
      renderInitialStreamState();
    }
  }
}

function renderInitialStreamState() {
  const stream = document.getElementById("geminiActiveStream");
  if (!stream) return;
  const savedKey = sessionStorage.getItem("gemini_api_key");
  if (!savedKey) {
    stream.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-zinc-500 gap-4 text-center p-8">
        <div class="text-4xl text-amber-500">🔑</div>
        <p class="text-sm font-mono max-w-md">No session key entered. Your key stays in active RAM only and clears automatically when this tab closes.</p>
        <button onclick="promptForApiKey()" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs transition shadow">Enter Session Key</button>
      </div>
    `;
  } else if (geminiSessionHistory.length === 0) {
    stream.innerHTML = `
      <div class="h-full flex items-center justify-center text-zinc-500 text-sm font-mono text-center p-8 leading-relaxed">
        Ready. Inspect a photo in the left lightbox (or Multi-Select several photos in the left grid to combine subjects), then send a prompt below.
      </div>
    `;
  }
}

function toggleGeminiStudio() {
  if (isGeminiStudioOpen) closeGeminiModal();
  else openGeminiModal();
}

function openGeminiModal() {
  const stage = document.getElementById("mainWorkspaceStage");
  const secondaryMount = document.getElementById("secondaryWorkspaceMount");
  const geminiMount = document.getElementById("geminiStudioMount");
  const splitControls = document.getElementById("splitDockControls");
  const dockBtn = document.getElementById("geminiDockToggleBtn");

  pinnedSplitRef = null;
  const preOpenWs = (typeof window.getActiveWorkspace === "function")
    ? window.getActiveWorkspace()
    : window.primaryWorkspace;
  const preOpenRefs = extractWorkspaceReferences(preOpenWs);
  if (preOpenRefs.paths.length > 0) {
    pinnedSplitRef = preOpenRefs;
  }

  // Dock into Pane 2's slot without destroying Split Mode state
  wasSplitBeforeGemini = (typeof isSplitMode !== "undefined" && isSplitMode);
  if (wasSplitBeforeGemini) {
    if (secondaryMount) secondaryMount.classList.add("hidden");
    if (splitControls) splitControls.classList.add("hidden");
  }

  isGeminiStudioOpen = true;
  stage.classList.remove("grid-cols-1");
  stage.classList.add("grid-cols-2");
  geminiMount.classList.remove("hidden");

  if (dockBtn) {
    dockBtn.className = "px-3.5 py-2 bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white rounded-lg text-sm font-black flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-rose-600/40 whitespace-nowrap";
  }

  updateKeyStatusUI();
  updateHistoryBadge();
  syncGeminiReferenceUI(true);
  switchStageView('active');
  if (geminiSessionHistory.length === 0) {
    renderInitialStreamState();
  }

  const inputEl = document.getElementById("geminiInput");
  if (inputEl && sessionStorage.getItem("gemini_api_key")) {
    setTimeout(() => inputEl.focus(), 50);
  }
}

function closeGeminiModal() {
  const vidEl = document.getElementById("geminiSourceVideo");
  if (vidEl) { vidEl.pause(); vidEl.src = ""; }
  const stage = document.getElementById("mainWorkspaceStage");
  const secondaryMount = document.getElementById("secondaryWorkspaceMount");
  const geminiMount = document.getElementById("geminiStudioMount");
  const splitControls = document.getElementById("splitDockControls");
  const dockBtn = document.getElementById("geminiDockToggleBtn");

  pinnedSplitRef = null;
  isGeminiStudioOpen = false;
  if (geminiMount) geminiMount.classList.add("hidden");

  if (wasSplitBeforeGemini && typeof isSplitMode !== "undefined" && isSplitMode) {
    if (secondaryMount) secondaryMount.classList.remove("hidden");
    if (splitControls) splitControls.classList.remove("hidden");
    if (stage) {
      stage.classList.remove("grid-cols-1");
      stage.classList.add("grid-cols-2");
    }
  } else {
    if (stage) {
      stage.classList.remove("grid-cols-2");
      stage.classList.add("grid-cols-1");
    }
  }
  wasSplitBeforeGemini = false;

  if (dockBtn) {
    dockBtn.className = "px-3.5 py-2 bg-gradient-to-r from-indigo-950 to-sky-950 hover:from-indigo-900 hover:to-sky-900 border border-sky-500/60 text-sky-200 rounded-lg text-sm font-black flex items-center gap-1.5 transition shrink-0 shadow whitespace-nowrap";
  }
}

function appendGeminiModifier(mod) {
  const input = document.getElementById("geminiInput");
  if (!input) return;
  if (!input.value.includes(mod)) {
    input.value = input.value ? `${input.value}, ${mod}` : mod;
  }
  input.focus();
}

function triggerGeminiQuickPrompt(promptText) {
  const input = document.getElementById("geminiInput");
  if (!input) return;
  input.value = promptText;
  input.focus();
}

function switchStageView(view) {
  const activeStage = document.getElementById("geminiActiveStage");
  const historyStage = document.getElementById("geminiHistoryStage");
  if (!activeStage || !historyStage) return;

  if (view === 'history') {
    isHistoryViewActive = true;
    activeStage.classList.add("hidden");
    historyStage.classList.remove("hidden");
    renderSessionHistory();
  } else {
    isHistoryViewActive = false;
    historyStage.classList.add("hidden");
    activeStage.classList.remove("hidden");
  }
}

function toggleSessionHistoryView() {
  switchStageView(isHistoryViewActive ? 'active' : 'history');
}

function updateHistoryBadge() {
  const badge = document.getElementById("historyCountBadge");
  if (badge) badge.textContent = geminiSessionHistory.length;
}

function renderSessionHistory() {
  const stage = document.getElementById("geminiHistoryStage");
  if (!stage) return;
  stage.innerHTML = "";

  if (geminiSessionHistory.length === 0) {
    stage.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-zinc-600 gap-3 text-center">
        <span class="text-4xl">🕒</span>
        <p class="text-sm font-mono max-w-sm">No generated candidates in active memory.</p>
        <p class="text-xs font-mono text-zinc-500">Unsaved photos will be discarded when you exit Tagger.</p>
      </div>`;
    return;
  }

  const disclaimer = document.createElement("div");
  disclaimer.className = "text-center mb-4";
  disclaimer.innerHTML = `<p class="text-xs font-mono text-amber-400 bg-amber-950/40 border border-amber-800/60 inline-block px-4 py-1.5 rounded-lg">⚠️ Unsaved photos will be discarded when you exit Tagger.</p>`;
  stage.appendChild(disclaimer);

  geminiSessionHistory.forEach(item => {
    const card = document.createElement("div");
    card.className = "bg-zinc-900 border border-zinc-700 rounded-2xl p-5 flex flex-col gap-4 shadow-xl";
    card.innerHTML = `
      <div class="flex items-center justify-between font-mono text-xs text-zinc-400">
        <span class="font-bold">${escapeHtml(item.timestamp)} • ${escapeHtml(item.sourcePaths.join(", "))}</span>
        <span class="text-sky-400 font-bold bg-sky-950 px-2.5 py-1 rounded border border-sky-800">${escapeHtml(item.model)}</span>
      </div>
      <div class="flex items-center justify-center bg-black rounded-xl border border-zinc-800 p-2">
        <img class="w-full h-auto max-h-[45vh] object-contain rounded-lg" src="${item.blobUrl}" />
      </div>
      <pre class="text-xs font-mono text-zinc-200 whitespace-pre-wrap bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 leading-relaxed">Prompt: ${escapeHtml(item.prompt)}</pre>
      <div class="flex flex-wrap items-center gap-2.5 pt-2 border-t border-zinc-800">
        <button onclick="restorePromptById('${item.id}')" class="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black rounded-xl transition">⮞ Use Prompt</button>
        <button onclick="copyPromptById('${item.id}')" class="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black rounded-xl transition">📋 Copy Prompt</button>
        <button onclick="loadHistoryItemToStage('${item.id}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition shadow flex items-center gap-1.5"><span>🖼</span> <span>Inspect</span></button>
        <button onclick="retryGeminiHistory('${item.id}')" class="px-4 py-2 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 text-xs font-black rounded-xl transition shadow flex items-center gap-1.5"><span>🔄</span> <span>Retry</span></button>
        ${
          item.saved
            ? `<span class="ml-auto text-xs font-mono text-emerald-400 font-bold px-3.5 py-2 bg-emerald-950 border border-emerald-800 rounded-xl">✓ Saved (${escapeHtml(item.savedName)})</span>`
            : `<button onclick="commitGeminiArtifact('${item.id}', this)" class="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition shadow flex items-center gap-1.5"><span>💾</span> <span>Save Photo</span></button>`
        }
      </div>
    `;
    stage.appendChild(card);
  });
}

function loadHistoryItemToStage(id) {
  const item = geminiSessionHistory.find(h => h.id === id);
  if (!item) return;

  switchStageView('active');
  const stream = document.getElementById("geminiActiveStream");

  stream.innerHTML = `
    <div class="flex-grow flex flex-col items-center justify-center w-full p-4 relative overflow-hidden">
      <img src="${item.blobUrl}" class="max-w-full max-h-[58vh] object-contain rounded-2xl shadow-2xl border border-zinc-800" />
    </div>
    <div class="w-full shrink-0 bg-zinc-950 border-t border-zinc-800 p-4 flex flex-col gap-3 rounded-xl">
      <div id="activeSaveActions_${item.id}" class="flex items-center justify-between gap-3">
        ${
          item.saved
            ? `<span class="text-xs font-mono text-emerald-400 font-bold px-4 py-2 bg-emerald-950 border border-emerald-800 rounded-xl">✓ Saved alongside original: ${escapeHtml(item.savedName)}</span>`
            : `<button onclick="commitGeminiArtifact('${item.id}')" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition shadow-lg flex items-center gap-2"><span>💾</span> <span>Save to Folder</span></button>`
        }
        <span class="text-xs font-mono text-zinc-500 truncate">Source(s): ${escapeHtml(item.sourcePaths.join(", "))}</span>
      </div>
      ${
        item.text
          ? `<div class="text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed select-text bg-zinc-900 p-3.5 rounded-xl border border-zinc-700">${escapeHtml(item.text)}</div>
             <div class="flex items-center gap-2.5">
               <button onclick="copyTextById('${item.id}')" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black rounded-xl transition">Copy Text</button>
               <button onclick="applyTagsById('${item.id}')" class="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl transition">Apply as Tags</button>
             </div>`
          : ""
      }
    </div>
  `;
}

function restorePromptById(id) {
  const item = geminiSessionHistory.find(h => h.id === id);
  const input = document.getElementById("geminiInput");
  if (item && input) {
    input.value = item.prompt;
    input.focus();
  }
}

function copyPromptById(id) {
  const item = geminiSessionHistory.find(h => h.id === id);
  if (item) {
    navigator.clipboard.writeText(item.prompt);
    if (typeof showToast === "function") showToast("Prompt copied");
  }
}

function copyTextById(id) {
  if (id) {
    const item = geminiSessionHistory.find(h => h.id === id);
    if (item && item.text) {
      navigator.clipboard.writeText(item.text);
      if (typeof showToast === "function") showToast("Copied to clipboard");
    }
  } else if (lastGeminiTextOutput) {
    navigator.clipboard.writeText(lastGeminiTextOutput);
    if (typeof showToast === "function") showToast("Copied to clipboard");
  }
}

async function applyTagsById(id) {
  let textToParse = lastGeminiTextOutput;
  let targetDir = "";
  let targetRels = [];

  if (id) {
    const item = geminiSessionHistory.find(h => h.id === id);
    if (item) {
      textToParse = item.text;
      targetDir = item.sourceDir;
      targetRels = item.sourcePaths;
    }
  } else {
    const refs = getActiveGeminiReferences();
    targetDir = refs.dir;
    targetRels = refs.paths;
  }

  if (!textToParse) return;
  const rawTokens = textToParse
    .replace(/[\[\]\(\)\*\#]/g, "")
    .split(/[,\n]/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 1 && t.length < 35 && !t.includes(":"));

  const tags = Array.from(new Set(rawTokens)).slice(0, 12);
  if (tags.length === 0) {
    if (typeof showToast === "function") showToast("Could not parse tags from output");
    return;
  }

  if (targetDir && targetRels.length > 0) {
    await fetch("/api/tags/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dir: targetDir, relative_paths: targetRels, tags })
    });
    const workspaces = [window.primaryWorkspace, window.secondaryWorkspace].filter(Boolean);
    for (const w of workspaces) {
      if (w.getDirectory() === targetDir) {
        await w.setDirectory(targetDir, w.getState());
      }
    }
    if (typeof showToast === "function") showToast(`Applied ${tags.length} AI tags to ${targetRels[0]}`);
  } else {
    const ws = (typeof window.getActiveWorkspace === "function") ? window.getActiveWorkspace() : window.primaryWorkspace;
    if (ws) await ws.applyTags(tags);
  }
}

async function handleGeminiSubmit(e) {
  if (e) e.preventDefault();

  const { dir, paths } = getActiveGeminiReferences();
  if (!dir || paths.length === 0) {
    if (typeof showToast === "function") showToast("Select or inspect a photo first");
    return;
  }

  const input = document.getElementById("geminiInput");
  const prompt = (input.value || "").trim();
  if (!prompt) return;

  await runGeminiRequest(dir, paths, prompt);
}

async function retryGeminiHistory(id) {
  const item = geminiSessionHistory.find(h => h.id === id);
  if (!item) return;

  const input = document.getElementById("geminiInput");
  if (input) input.value = item.prompt;

  await runGeminiRequest(item.sourceDir, item.sourcePaths, item.prompt);
}

async function runGeminiRequest(dir, paths, prompt) {
  const savedKey = sessionStorage.getItem("gemini_api_key") || "";
  if (!savedKey) {
    promptForApiKey();
    return;
  }

  const aspect = document.getElementById("geminiAspectSelect")?.value || "1:1";
  const model = document.getElementById("geminiModelSelect")?.value || "gemini-3.1-flash-image";
  const submitBtn = document.getElementById("geminiSubmitBtn");

  switchStageView('active');
  const stream = document.getElementById("geminiActiveStream");

  submitBtn.disabled = true;
  stream.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full h-full gap-5 text-sky-400">
      <div class="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-base font-mono font-black tracking-widest uppercase">GENERATING IMAGE... (${paths.length} ref${paths.length > 1 ? 's' : ''})</span>
    </div>
  `;

  try {
    const res = await fetch("/api/gemini/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dir: dir,
        relative_path: paths[0],
        relative_paths: paths,
        prompt: prompt,
        aspect_ratio: aspect,
        model: model,
        api_key: savedKey
      })
    });

    const data = await res.json();
    stream.innerHTML = "";

    if (data.notice || !data.ok) {
      const isError = !data.ok;
      const color = isError ? "rose" : "amber";
      const icon = isError ? "⚠️" : "🛡";
      stream.innerHTML = `
        <div class="m-auto max-w-xl w-full bg-${color}-950 border border-${color}-700/50 rounded-2xl p-6 shadow-2xl flex flex-col gap-3">
          <div class="flex items-center gap-3 text-${color}-400">
            <span class="text-2xl">${icon}</span>
            <span class="font-black tracking-widest text-base uppercase">${isError ? "Error" : "Notice"}</span>
          </div>
          <p class="text-sm font-mono text-${color}-200/90 leading-relaxed whitespace-pre-wrap">${escapeHtml(data.notice || "Action failed.")}</p>
        </div>
      `;
      return;
    }

    if (data.text) lastGeminiTextOutput = data.text;

    if (data.images && data.images.length > 0) {
      data.images.forEach(img => {
        const mime = img.MimeType || img.mime_type || "image/png";
        const b64 = img.Data || img.data;
        const blobUrl = base64ToBlobUrl(b64, mime);
        
        const turnRecord = {
          id: img.ID || img.id,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sourceDir: dir,
          sourcePaths: paths,
          prompt: prompt,
          model: model,
          data: b64,
          mime_type: mime,
          blobUrl: blobUrl,
          saved: false,
          savedName: "",
          text: data.text || ""
        };
        
        geminiSessionHistory.unshift(turnRecord);
        if (geminiSessionHistory.length > 30) {
          const removed = geminiSessionHistory.pop();
          if (removed && removed.blobUrl) URL.revokeObjectURL(removed.blobUrl);
        }
        updateHistoryBadge();
        loadHistoryItemToStage(turnRecord.id);
      });
    } else if (data.text) {
      stream.innerHTML = `
        <div class="w-full h-full flex flex-col p-4 overflow-hidden">
          <div class="flex-grow overflow-y-auto text-sm font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed select-text bg-zinc-900 p-5 rounded-2xl border border-zinc-700">${escapeHtml(data.text)}</div>
          <div class="flex items-center gap-3 shrink-0 mt-4 pt-4 border-t border-zinc-800">
            <button onclick="copyTextById()" class="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black rounded-xl transition">Copy Text</button>
            <button onclick="applyTagsById()" class="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl transition">Apply as Tags</button>
          </div>
        </div>
      `;
    }

  } catch (err) {
    stream.innerHTML = `
      <div class="m-auto max-w-xl w-full bg-rose-950 border border-rose-800/50 rounded-2xl p-6 shadow-2xl flex flex-col gap-3">
        <div class="flex items-center gap-3 text-rose-400">
          <span class="text-2xl">⚠️</span>
          <span class="font-black tracking-widest text-base uppercase">Client Error</span>
        </div>
        <p class="text-sm font-mono text-rose-200/90 leading-relaxed whitespace-pre-wrap">${escapeHtml(err.message)}</p>
      </div>
    `;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function commitGeminiArtifact(recordId, btnEl = null) {
  const item = geminiSessionHistory.find(h => h.id === recordId);
  if (!item || item.saved) return;

  try {
    const res = await fetch("/api/gemini/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dir: item.sourceDir,
        relative_path: item.sourcePaths[0],
        data: item.data
      })
    });

    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();

    item.saved = true;
    item.savedName = result.file_name;

    const actions = document.getElementById(`activeSaveActions_${recordId}`);
    if (actions) {
      actions.innerHTML = `<span class="text-xs font-mono text-emerald-400 font-bold px-4 py-2 bg-emerald-950 border border-emerald-800 rounded-xl">✓ Saved alongside original: ${escapeHtml(result.file_name)}</span>`;
    }

    if (btnEl && btnEl.parentElement) {
      btnEl.outerHTML = `<span class="ml-auto text-xs font-mono text-emerald-400 font-bold px-3.5 py-2 bg-emerald-950 border border-emerald-800 rounded-xl">✓ Saved (${escapeHtml(result.file_name)})</span>`;
    }

    if (typeof showToast === "function") showToast(`Saved: ${result.file_name}`, 3000);
    if (typeof clearLastAction === "function") {
      clearLastAction();
    }
    const workspaces = [window.primaryWorkspace, window.secondaryWorkspace].filter(Boolean);
    for (const w of workspaces) {
      if (w.getDirectory() === item.sourceDir) {
        await w.setDirectory(item.sourceDir, w.getState());
      }
    }
  } catch (err) {
    if (typeof showToast === "function") showToast("Failed to save: " + err.message, 4000);
  }
}

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "g" || e.key === "G")) {
    e.preventDefault();
    toggleGeminiStudio();
  }
});
