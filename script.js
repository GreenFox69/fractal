(() => {
  const canvas = document.getElementById("mandelbrot");
  const context = canvas.getContext("2d", { alpha: false });
  const iterationsInput = document.getElementById("iterations");
  const iterationsValue = document.getElementById("iterations-value");
  const coordsOutput = document.getElementById("coords");
  const scaleOutput = document.getElementById("scale");
  const zoomInButton = document.getElementById("zoom-in");
  const zoomOutButton = document.getElementById("zoom-out");
  const resetButton = document.getElementById("reset-btn");

  const INITIAL_ITERATIONS = 180;
  const BASE_VIEW_WIDTH = 3.5;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 2000;
  const ZOOM_FACTOR = 1.3;

  let width = 0;
  let height = 0;
  let centerX = -0.5;
  let centerY = 0;
  let zoom = 1;
  let maxIterations = INITIAL_ITERATIONS;
  let renderVersion = 0;
  let resizeObserver;
  let dragPosition = null;
  let lastWheelTime = 0;

  function getViewSize() {
    const viewWidth = BASE_VIEW_WIDTH / zoom;
    return { width: viewWidth, height: viewWidth / (width / height) };
  }

  function updateReadout() {
    iterationsValue.value = maxIterations;
    iterationsValue.textContent = maxIterations;
    coordsOutput.textContent = `${centerX.toFixed(4)}, ${centerY.toFixed(4)}`;
    scaleOutput.textContent = `${zoom.toFixed(2)}×`;
    zoomInButton.disabled = zoom >= MAX_ZOOM;
    zoomOutButton.disabled = zoom <= MIN_ZOOM;
  }

  function requestRender() {
    updateReadout();
    const currentVersion = ++renderVersion;
    if (!width || !height) return;

    const image = context.createImageData(width, height);
    const pixels = image.data;
    const view = getViewSize();
    const left = centerX - view.width / 2;
    const top = centerY - view.height / 2;
    const stepX = view.width / width;
    const stepY = view.height / height;
    let row = 0;

    function renderRows() {
      if (currentVersion !== renderVersion) return;
      const startTime = performance.now();

      while (row < height && performance.now() - startTime < 10) {
        const imaginary = top + row * stepY;
        for (let column = 0; column < width; column++) {
          const real = left + column * stepX;
          let zx = 0;
          let zy = 0;
          let zxSquared = 0;
          let zySquared = 0;
          let iteration = 0;

          while (iteration < maxIterations && zxSquared + zySquared <= 4) {
            zy = 2 * zx * zy + imaginary;
            zx = zxSquared - zySquared + real;
            zxSquared = zx * zx;
            zySquared = zy * zy;
            iteration++;
          }

          const offset = (row * width + column) * 4;
          if (iteration === maxIterations) {
            pixels[offset] = 8;
            pixels[offset + 1] = 9;
            pixels[offset + 2] = 16;
          } else {
            const smooth = iteration + 1 - Math.log2(Math.max(1, Math.log2(Math.sqrt(zxSquared + zySquared))));
            const hue = (0.62 + smooth * 0.028) % 1;
            const saturation = 0.72;
            const brightness = 0.95;
            const sector = hue * 6;
            const chroma = brightness * saturation;
            const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
            const match = brightness - chroma;
            let red = 0;
            let green = 0;
            let blue = 0;

            if (sector < 1) [red, green] = [chroma, secondary];
            else if (sector < 2) [red, green] = [secondary, chroma];
            else if (sector < 3) [green, blue] = [chroma, secondary];
            else if (sector < 4) [green, blue] = [secondary, chroma];
            else if (sector < 5) [red, blue] = [secondary, chroma];
            else [red, blue] = [chroma, secondary];

            pixels[offset] = Math.round((red + match) * 255);
            pixels[offset + 1] = Math.round((green + match) * 255);
            pixels[offset + 2] = Math.round((blue + match) * 255);
          }
          pixels[offset + 3] = 255;
        }
        row++;
      }

      if (row < height) {
        requestAnimationFrame(renderRows);
      } else if (currentVersion === renderVersion) {
        context.putImageData(image, 0, 0);
      }
    }

    requestAnimationFrame(renderRows);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deviceRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const resolutionScale = Math.min(deviceRatio, 1200 / rect.width);
    const nextWidth = Math.max(1, Math.round(rect.width * resolutionScale));
    const nextHeight = Math.max(1, Math.round(rect.height * resolutionScale));
    if (nextWidth === width && nextHeight === height) return;

    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
    requestRender();
  }

  function zoomAt(normalizedX, normalizedY, factor) {
    if (!width || !height) return;
    const oldView = getViewSize();
    const worldX = centerX + (normalizedX - 0.5) * oldView.width;
    const worldY = centerY + (normalizedY - 0.5) * oldView.height;
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    const newView = getViewSize();
    centerX = worldX - (normalizedX - 0.5) * newView.width;
    centerY = worldY - (normalizedY - 0.5) * newView.height;
    requestRender();
  }

  function zoomAtCenter(factor) {
    zoomAt(0.5, 0.5, factor);
  }

  function resetView() {
    centerX = -0.5;
    centerY = 0;
    zoom = 1;
    maxIterations = INITIAL_ITERATIONS;
    iterationsInput.value = String(INITIAL_ITERATIONS);
    requestRender();
  }

  iterationsInput.addEventListener("input", () => {
    maxIterations = Number(iterationsInput.value);
    requestRender();
  });

  zoomInButton.addEventListener("click", () => zoomAtCenter(ZOOM_FACTOR));
  zoomOutButton.addEventListener("click", () => zoomAtCenter(1 / ZOOM_FACTOR));
  resetButton.addEventListener("click", resetView);

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheelTime < 35 || Math.abs(event.deltaY) < 2) return;
    lastWheelTime = now;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    zoomAt(x, y, event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR);
  }, { passive: false });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    dragPosition = { x: event.clientX, y: event.clientY };
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragPosition) return;
    const rect = canvas.getBoundingClientRect();
    const view = getViewSize();
    centerX -= ((event.clientX - dragPosition.x) / rect.width) * view.width;
    centerY -= ((event.clientY - dragPosition.y) / rect.height) * view.height;
    dragPosition = { x: event.clientX, y: event.clientY };
    requestRender();
  });

  canvas.addEventListener("pointerup", () => {
    dragPosition = null;
  });
  canvas.addEventListener("pointercancel", () => {
    dragPosition = null;
  });

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "+" || event.key === "=") zoomAtCenter(ZOOM_FACTOR);
    else if (event.key === "-") zoomAtCenter(1 / ZOOM_FACTOR);
    else if (event.key === "Escape") resetView();
  });

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }

  resizeCanvas();
  updateReadout();
})();
