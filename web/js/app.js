window.addEventListener("keydown", (e) => {
const activeEl = document.activeElement;
if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT")) {
return;
}

// Lightbox Hotkeys
if (!document.getElementById("lightbox").classList.contains("hidden")) {
if (e.key === "ArrowRight") navigateLightbox(1);
if (e.key === "ArrowLeft") navigateLightbox(-1);
if (e.key === "Escape") closeLightbox();
if (e.key === " ") {
e.preventDefault();
toggleSelectFromLightbox();
}
}

// Palette 1-9 Hotkeys
if (e.key >= "1" && e.key <= "9") {
const idx = parseInt(e.key, 10) - 1;
const currentTags = presets[activePresetKey] || [];
if (idx < currentTags.length) {
applyTagBatch([currentTags[idx]]);
}
}

// Mode toggle hotkey 't'
if (e.key.toLowerCase() === "t") {
toggleInteractionMode();
}
});

// App initialization
renderPresetSelector();
