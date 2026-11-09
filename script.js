/**
 * Mandelbrot фрактал — отрисовка на HTML5 Canvas
 * Запуск: откройте index.html или обслуживайте папку через http://127.0.0.1:PORT
 */

(function () {
  const canvas = document.getElementById("mandelbrot");
  const ctx = canvas.getContext("2d", { alpha: false });

  const iterInput = document.getElementById("iterations");
  const iterValue = document.getElementById("iterations-value");
  const resetBtn = document.getElementById("reset-btn");
  const coordsEl = document.getElementById("coords");
  const scaleEl = document.getElementById("scale");

  // Состояние вида (комплексная плоскость)
  let width = 0;
  let height = 0;
  let dpr = 1;
  let cx = -0.5; // центр по X (действительная часть)
  let cy = 0.0; // центр по Y (мнимая часть)
  let zoom = 1.0; // 1.0 ~ стандартный вид от -2..2
  let maxIter = 100;

  // Состояние мыши
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  let renderId = null;
  let pending = false;

  /* ---------- Ядро вычислений Мандельброта ---------- */
  function render() {
    if (!width || !height) return;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Окно просмотра в комплексной плоскости
    const aspect = width / height;
    const baseViewW = 3.5; // ширина окна при zoom = 1
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
          // Внутри множества — чёрный
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        } else {
          // Красочная градиентная раскраска по количеству итераций
          const t = i * invMaxIter;
          const r = Math.floor(9 * (1 - t) * t * t * t * 255);
          const g = Math.floor(15 * (1 - t) * (1 - t) * t * t * 255);
          const b = Math.floor(8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255);
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
  }

  function updateUI() {
    iterValue.textContent = maxIter;
    coordsEl.textContent = cx.toFixed(2) + ", " + cy.toFixed(2);
    scaleEl.textContent = zoom.toFixed(2) + "×";
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
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    lastMouse = { x: e.clientX, y: e.clientY };

    const aspect = width / height;
    const viewW = (3.5 / zoom);
    const viewH = viewW / aspect;

    // Сдвигаем центр противоположно движению мыши
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
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = -e.deltaY * 0.001;
    let newZoom = zoom * (1 + delta);
    if (newZoom < 0.1) newZoom = 0.1;
    if (newZoom > 2000) newZoom = 2000;

    const aspect = width / height;
    const oldViewW = (3.5 / zoom);
    const oldViewH = oldViewW / aspect;
    const newViewW = (3.5 / newZoom);
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

  /* ---------- Старт ---------- */
  resize();
})();
