const canvas = document.querySelector("#fractal");
const ctx = canvas.getContext("2d", { alpha: false });
const slider = document.querySelector("#iterations");
const iterationValue = document.querySelector("#iterationValue");
const zoomValue = document.querySelector("#zoomValue");
const resetButton = document.querySelector("#resetButton");
const loading = document.querySelector("#loading");

const view = { centerX: -0.5, centerY: 0, span: 3.5 };
let maxIterations = Number(slider.value);
let renderRequest = 0;

const palette = Array.from({ length: 256 }, (_, i) => {
  const t = i / 255;
  return [
    Math.round(9 + 30 * Math.sin(t * 6.2 + 0.2) ** 2 + 78 * t ** 2),
    Math.round(10 + 22 * Math.sin(t * 6.2 + 2.1) ** 2 + 49 * t),
    Math.round(24 + 48 * Math.sin(t * 6.2 + 4.1) ** 2 + 130 * t),
  ];
});

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    render();
  }
}

function render() {
  const requestId = ++renderRequest;
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) return;

  loading.classList.add("visible");
  const image = ctx.createImageData(width, height);
  const pixels = image.data;
  const aspect = width / height;
  const spanX = view.span;
  const spanY = spanX / aspect;
  const startX = view.centerX - spanX / 2;
  const startY = view.centerY - spanY / 2;
  const stepX = spanX / width;
  const stepY = spanY / height;

  let y = 0;
  const rowsPerFrame = Math.max(1, Math.floor(18000 / width));

  function drawChunk() {
    if (requestId !== renderRequest) return;
    const endY = Math.min(height, y + rowsPerFrame);

    for (; y < endY; y++) {
      const ci = startY + y * stepY;
      for (let x = 0; x < width; x++) {
        const cr = startX + x * stepX;
        let zr = 0;
        let zi = 0;
        let iteration = 0;

        while (zr * zr + zi * zi <= 256 && iteration < maxIterations) {
          const nextZr = zr * zr - zi * zi + cr;
          zi = 2 * zr * zi + ci;
          zr = nextZr;
          iteration++;
        }

        const offset = (y * width + x) * 4;
        if (iteration === maxIterations) {
          pixels[offset] = 7;
          pixels[offset + 1] = 9;
          pixels[offset + 2] = 17;
        } else {
          const magnitude = Math.sqrt(zr * zr + zi * zi);
          const smooth = iteration + 1 - Math.log2(Math.max(1, Math.log2(magnitude)));
          const colorIndex = ((Math.floor(smooth * 7) % 256) + 256) % 256;
          const color = palette[colorIndex];
          pixels[offset] = color[0];
          pixels[offset + 1] = color[1];
          pixels[offset + 2] = color[2];
        }
        pixels[offset + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    if (y < height) requestAnimationFrame(drawChunk);
    else loading.classList.remove("visible");
  }

  requestAnimationFrame(drawChunk);
}

function updateZoomLabel() {
  zoomValue.textContent = `${(3.5 / view.span).toFixed(2)}×`;
}

function zoomAt(clientX, clientY, factor) {
  const rect = canvas.getBoundingClientRect();
  const aspect = canvas.width / canvas.height;
  const spanY = view.span / aspect;
  const xFraction = (clientX - rect.left) / rect.width;
  const yFraction = (clientY - rect.top) / rect.height;
  const pointX = view.centerX + (xFraction - 0.5) * view.span;
  const pointY = view.centerY + (yFraction - 0.5) * spanY;

  view.span = Math.max(1e-12, Math.min(7, view.span * factor));
  const newSpanY = view.span / aspect;
  view.centerX = pointX - (xFraction - 0.5) * view.span;
  view.centerY = pointY - (yFraction - 0.5) * newSpanY;
  updateZoomLabel();
  render();
}

slider.addEventListener("input", () => {
  maxIterations = Number(slider.value);
  iterationValue.value = maxIterations;
  iterationValue.textContent = maxIterations;
  render();
});

resetButton.addEventListener("click", () => {
  view.centerX = -0.5;
  view.centerY = 0;
  view.span = 3.5;
  updateZoomLabel();
  render();
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 0.8 : 1.25);
}, { passive: false });

canvas.addEventListener("dblclick", (event) => zoomAt(event.clientX, event.clientY, 0.5));

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(canvas);
updateZoomLabel();
resizeCanvas();
