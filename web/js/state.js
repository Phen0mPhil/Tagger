let allEntries = [];
let filteredEntries = [];
let selectedSet = new Set();
let currentDir = "";
let isSelectMode = false;
let untaggedOnly = false;

// Pagination State
let currentPage = 1;
let pageSize = 100;

// Lightbox & Slideshow State
let lbIndex = 0;
let slideshowInterval = null;
let slideshowPool = [];

// Tag Presets State
let presets = JSON.parse(localStorage.getItem("tag_presets")) || {
"Beach Wear": ["bikini", "onepiece", "tropikini", "beach", "sunset", "ocean"],
"Portraits": ["close-up", "smile", "bokeh", "studio", "fashion", "eyes"]
};
let activePresetKey = Object.keys(presets)[0] || "Beach Wear";

function showToast(msg, duration = 2500) {
const t = document.getElementById("toast");
if (!t) return;
t.textContent = msg;
t.classList.remove("hidden");
setTimeout(() => t.classList.add("hidden"), duration);
}
