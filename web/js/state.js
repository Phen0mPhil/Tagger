let allEntries = [];
let filteredEntries = [];
let selectedSet = new Set();
let currentDir = "";
let isSelectMode = false;
let untaggedOnly = false;

// Pagination State
let currentPage = 1;
let pageSize = 100;

// Tag Presets State
let presets = JSON.parse(localStorage.getItem("tag_presets")) || {
  "Beach Wear": ["bikini", "onepiece", "tropikini", "beach", "sunset", "ocean"],
  "Portraits": ["close-up", "smile", "bokeh", "studio", "fashion", "eyes"]
};
let activePresetKey = Object.keys(presets)[0] || "Beach Wear";

// Persistent Deck / Sequence State
let deck = JSON.parse(localStorage.getItem("tagger_deck")) || [];

function saveDeck() {
  localStorage.setItem("tagger_deck", JSON.stringify(deck));
  updateDeckUI();
}

function addToDeckFromSelection() {
  if (selectedSet.size === 0) {
    showToast("Select photos first to add to Deck");
    return;
  }

  // Preserve intentional repetition & exact folder roots
  selectedSet.forEach(rel => {
    const item = allEntries.find(e => e.relative_path === rel);
    if (item) {
      deck.push({
        dir: currentDir,
        relative_path: item.relative_path,
        file_name: item.file_name
      });
    }
  });

  saveDeck();
  showToast(`Added ${selectedSet.size} items to Deck (Total: ${deck.length})`);
  clearSelection();
}

function removeDeckItem(index) {
  if (index >= 0 && index < deck.length) {
    deck.splice(index, 1);
    saveDeck();
  }
}

function clearDeck() {
  deck = [];
  saveDeck();
  showToast("Deck cleared");
}

function updateDeckUI() {
  const countEl = document.getElementById("deckCountBadge");
  if (countEl) countEl.textContent = deck.length;
}

function showToast(msg, duration = 2500) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), duration);
}
