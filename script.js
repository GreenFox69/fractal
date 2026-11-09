(function () {
  const canvas = document.getElementById("mandelbrot");
  const ctx = canvas.getContext("2d");

  const iterInput = document.getElementById("iterations");
  const iterValue = document.getElementById("iterations-value");
  const resetBtn = document.getElementById("reset-btn");
  const coordsEl = document.getElementById("coords");
  const scaleEl = document.getElementById("scale");

  let width = 0;
  let height = 0;
  let cx = -0.5;
  let cy = 0.0;
  let zoom = 1.0;
  let maxIter = 100;

  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  let renderId = null;
  let pending = false;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    let w = Math.max(200, Math.min(rect.width || 600, 900));
    let h = Math.max(150, Math.min(rect.height || 400, 700));
    width = w;
    height = h;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    requestRender();
  }

  function render() {
    if (!width || !height || !ctx) return;
    try {
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;
      const aspect = width / height;
      const baseViewW = 3.5;
      const viewW = baseViewW / zoom;
      const viewH = viewW / aspect;
      const left = cx - viewW / 2;
      const top = cy - viewH / 2;
      const stepX = viewW / width;
      const stepY = viewH / height;
      const invMaxIter = 1.0 / maxIter;
      let idx = 0;
      for (let py = 0; py < height; py++) {
        const cy0 = top + py * stepY;
        for (let px = 0; px < width; px++) {
          const cx0 = left + px * stepX;
          let zx = 0;
          let zy = 0;
          let zx2 = 0;
          let zy2 = 0;
          let i = 0;
          while (i < maxIter && zx2 + zy2 <= 4.0) {
            const xt = zx2 - zy2 + cx0;
            zy = 2.0 * zx * zy + cy0;
            zx = xt;
            zx2 = zx * zx;
            zy2 = zy * zy;
            i++;
          }
          if (i === maxIter) {
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 255;
          } else {
            const t = i * invMaxIter;
            const r = Math.floor(255 * (1 - t));
            const g = Math.floor(255 * t * (1 - t) * 4);
            const b = Math.floor(255 * t * t);
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
          }
          idx += 4;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      updateUI();
    } catch (e) {
      console.error("Render error:", e);
    }
  }
  function updateUI() {
    if (iterValue) iterValue.textContent = maxIter;
    if (coordsEl) coordsEl.textContent = cx.toFixed(3) + ", " + cy.toFixed(3);
    if (scaleEl) scaleEl.textContent = zoom.toFixed(2) + "\u00d7";
  }

  function requestRender() {
    if (pending) return;
    pending = true;
    cancelAnimationFrame(renderId);
    renderId = requestAnimationFrame(() => {
      render();
      pending = false;
    });
  }

  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging || !width || !height) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    lastMouse = { x: e.clientX, y: e.clientY };
    const aspect = width / height;
    const viewW = 3.5 / zoom;
    const viewH = viewW / aspect;
    cx -= (dx / width) * viewW;
    cy += (dy / height) * viewH;
    requestRender();
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
    canvas.style.cursor = "grab";
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (!width || !height) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = -e.deltaY * 0.001;
    let newZoom = zoom * (1 + delta);
    if (newZoom < 0.1) newZoom = 0.1;
    if (newZoom > 2000) newZoom = 2000;
    const aspect = width / height;
    const oldViewW = 3.5 / zoom;
    const oldViewH = oldViewW / aspect;
    const newViewW = 3.5 / newZoom;
    const newViewH = newViewW / aspect;
    const worldX = cx - oldViewW / 2 + (mouseX / rect.width) * oldViewW;
    const worldY = cy - oldViewH / 2 + (mouseY / rect.height) * oldViewH;
    cx = worldX - newViewW / 2 + (mouseX / rect.width) * newViewW;
    cy = worldY - newViewH / 2 + (mouseY / rect.height) * newViewH;
    zoom = newZoom;
    requestRender();
  }, { passive: false });

  iterInput.addEventListener("input", () => {
    maxIter = parseInt(iterInput.value, 10) || 100;
    requestRender();
  });

  resetBtn.addEventListener("click", () => {
    cx = -0.5;
    cy = 0.0;
    zoom = 1.0;
    maxIter = 100;
    iterInput.value = "100";
    requestRender();
  });

  window.addEventListener("resize", () => {
    resize();
  });

  resize();
})();

