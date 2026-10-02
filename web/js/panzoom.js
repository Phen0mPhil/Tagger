// Standalone PanZoom Viewport Instance Factory (Focal Point Zoom)
function createPanZoom(container, img) {
  if (!container || !img) return null;

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let onSyncCallback = null;

  function applyTransform() {
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  function reset() {
    scale = 1;
    panX = 0;
    panY = 0;
    isDragging = false;
    applyTransform();
  }

  function setTransform(s, x, y) {
    scale = s;
    panX = x;
    panY = y;
    applyTransform();
  }

  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.2 : 0.83;
    const newScale = Math.min(Math.max(0.8, scale * factor), 8.0);

    // Focal zoom: calculate mouse position relative to container
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    // Adjust pan coordinates so the pixel under cursor stays stationary
    panX -= (mouseX - panX) * (newScale / scale - 1);
    panY -= (mouseY - panY) * (newScale / scale - 1);
    scale = newScale;

    applyTransform();
    if (onSyncCallback) onSyncCallback(scale, panX, panY);
  }, { passive: false });

  container.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    container.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
    if (onSyncCallback) onSyncCallback(scale, panX, panY);
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    container.style.cursor = "grab";
  });

  container.addEventListener("dblclick", () => {
    reset();
    if (onSyncCallback) onSyncCallback(scale, panX, panY);
  });

  container.style.cursor = "grab";

  return {
    reset,
    setTransform,
    getTransform: () => ({ scale, panX, panY }),
    onSync: (cb) => { onSyncCallback = cb; }
  };
}
