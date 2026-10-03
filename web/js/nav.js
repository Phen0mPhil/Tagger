// Decoupled Directory Navigation Component Factory
function createDirectoryNavigator({ breadcrumbEl, subfolderEl, onNavigate }) {
  if (!breadcrumbEl || !subfolderEl) return null;

  async function update(targetPath) {
    if (!targetPath) {
      breadcrumbEl.innerHTML = '<span class="text-zinc-600">Path:</span> <span class="text-zinc-500 italic">No folder</span>';
      subfolderEl.innerHTML = '';
      return;
    }

    try {
      const res = await fetch(`/api/browse?dir=${encodeURIComponent(targetPath)}`);
      if (!res.ok) return;
      const data = await res.json();

      // Render interactive breadcrumbs
      breadcrumbEl.innerHTML = '<span class="text-zinc-600">Path:</span>';
      const parts = data.current_path.split("/").filter(Boolean);
      let accum = "";

      parts.forEach((p, idx) => {
        accum += (accum === "" && p.includes(":")) ? p : "/" + p;
        const hopPath = accum;

        const btn = document.createElement("button");
        btn.className = "hover:text-sky-400 font-mono text-zinc-300 hover:underline transition";
        btn.textContent = p;
        btn.onclick = (e) => {
          e.stopPropagation();
          if (onNavigate) onNavigate(hopPath);
        };
        breadcrumbEl.appendChild(btn);

        if (idx < parts.length - 1) {
          const slash = document.createElement("span");
          slash.className = "text-zinc-600";
          slash.textContent = "/";
          breadcrumbEl.appendChild(slash);
        }
      });

      // Render interactive subfolder quick-hops
      subfolderEl.innerHTML = "";

      if (data.parent_path) {
        const up = document.createElement("button");
        up.className = "px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded text-[10px] font-medium transition shrink-0";
        up.textContent = "⤴ Up";
        up.onclick = (e) => {
          e.stopPropagation();
          if (onNavigate) onNavigate(data.parent_path);
        };
        subfolderEl.appendChild(up);
      }

      (data.subfolders || []).forEach(sub => {
        const b = document.createElement("button");
        b.className = "px-2 py-0.5 bg-zinc-900 hover:bg-sky-950 border border-zinc-800 hover:border-sky-800 text-zinc-300 hover:text-sky-300 rounded text-[10px] font-medium truncate max-w-[140px] transition shrink-0";
        b.textContent = `📁 ${sub.name}`;
        b.onclick = (e) => {
          e.stopPropagation();
          if (onNavigate) onNavigate(sub.path);
        };
        subfolderEl.appendChild(b);
      });
    } catch (err) {
      console.error("Directory navigation error:", err);
    }
  }

  return { update };
}
