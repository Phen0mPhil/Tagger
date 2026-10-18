let currentDir = "";
let isSelectMode = false;
let untaggedOnly = false;
let pageSize = 100;

function isVideoFile(filename) {
  const ext = (filename || "").split('.').pop().toLowerCase();
  return ['mp4', 'mov', 'webm', 'm4v'].includes(ext);
}

// Undo State Buffer
let lastAction = null;

function setLastAction(action) {
  lastAction = action;
  document.querySelectorAll(".ws-undo-btn").forEach(btn => btn.classList.remove("hidden"));
}

function clearLastAction() {
  lastAction = null;
  document.querySelectorAll(".ws-undo-btn").forEach(btn => btn.classList.add("hidden"));
}

// Tag Presets State
let presets = JSON.parse(localStorage.getItem("tag_presets")) || {
  "General": ["keeper", "best", "candid", "portrait", "landscape", "favorite"],
  "Review": ["needs crop", "fix color", "out of focus", "duplicate", "review"]
};
let activePresetKey = Object.keys(presets)[0] || "General";

// Persistent Playlist State
let deck = JSON.parse(localStorage.getItem("tagger_deck")) || [];

function saveDeck() {
  localStorage.setItem("tagger_deck", JSON.stringify(deck));
  updateDeckUI();
}

function updateDeckUI() {
  const badge = document.getElementById("deckCountBadge");
  if (badge) badge.textContent = deck.length;
}

function clearDeck() {
  deck = [];
  saveDeck();
}

function removeDeckItem(idx) {
  deck.splice(idx, 1);
  saveDeck();
}
