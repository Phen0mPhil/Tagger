function createTagDock({ containerEl, onTagSelected, onTagRemoved }) {
  let activeKey = Object.keys(presets)[0] || "General";

  function render(tagsToHighlight = []) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    const activeList = [...(presets[activeKey] || [])].sort((a, b) => a.localeCompare(b));
    activeList.forEach((tag) => {
      const isStamped = tagsToHighlight.includes(tag.toLowerCase());
      const btn = document.createElement("button");
      btn.className = `px-3.5 py-1.5 border rounded-md text-xs font-bold transition shrink-0 shadow-sm flex items-center ${
        isStamped
          ? "bg-sky-600 border-sky-400 text-white shadow-sky-600/30"
          : "bg-zinc-900 hover:bg-sky-950 border-zinc-800 hover:border-sky-500 text-zinc-200 hover:text-sky-200"
      }`;

      btn.textContent = tag;

      btn.onclick = (e) => {
        e.stopPropagation();
        if (isStamped && onTagRemoved) {
          onTagRemoved(tag);
        } else if (onTagSelected) {
          onTagSelected(tag);
        }
      };

      containerEl.appendChild(btn);
    });
  }

  function setPalette(key) {
    if (presets[key]) {
      activeKey = key;
      render();
    }
  }

  return { render, setPalette, getActiveKey: () => activeKey };
}
