// Modular Deck / Sequence Tray Controller

function openDeckModal() {
  const modal = document.getElementById("deckModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  renderDeckGrid();
}

function closeDeckModal() {
  const modal = document.getElementById("deckModal");
  if (modal) modal.classList.add("hidden");
}

function renderDeckGrid() {
  const container = document.getElementById("deckGridContainer");
  const countLabel = document.getElementById("deckModalCount");
  if (!container) return;

  container.innerHTML = "";
  countLabel.textContent = `${deck.length} items in sequence`;

  if (deck.length === 0) {
    container.innerHTML = `<div class="col-span-full py-12 text-center text-zinc-600 text-xs font-mono">The Deck is empty. Check photos on the grid and click "+ Deck" to stage sequences.</div>`;
    return;
  }

  deck.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "group relative bg-zinc-950 border border-zinc-800 rounded overflow-hidden flex flex-col p-1";

    const img = document.createElement("img");
    img.src = `/api/thumbnail?dir=${encodeURIComponent(item.dir)}&file=${encodeURIComponent(item.relative_path)}`;
    img.loading = "lazy";
    img.className = "w-full aspect-square object-cover rounded bg-zinc-900";

    const badge = document.createElement("span");
    badge.className = "absolute top-1.5 left-1.5 bg-black/80 border border-zinc-700 text-zinc-300 text-[10px] font-mono px-1 rounded";
    badge.textContent = `#${idx + 1}`;

    const delBtn = document.createElement("button");
    delBtn.className = "absolute top-1.5 right-1.5 w-5 h-5 bg-rose-950/90 hover:bg-rose-800 text-rose-300 rounded border border-rose-700/80 flex items-center justify-center text-xs font-bold transition";
    delBtn.innerHTML = "✕";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      removeDeckItem(idx);
      renderDeckGrid();
    };

    const label = document.createElement("span");
    label.className = "text-[10px] font-mono text-zinc-400 truncate mt-1 px-0.5";
    label.textContent = item.file_name;

    card.appendChild(badge);
    card.appendChild(delBtn);
    card.appendChild(img);
    card.appendChild(label);
    container.appendChild(card);
  });
}

function playDeckFromModal() {
  closeDeckModal();
  startDeckSlideshow();
}
