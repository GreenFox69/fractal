const canvas = document.querySelector("#mandelbrot");
const ctx = canvas.getContext("2d", { alpha: false });
const iterationsInput = document.querySelector("#iterations");
const iterationsLabel = document.querySelector("#iterations-label");
const statusNode = document.querySelector("#status");

const home = { x: -0.65, y: 0, width: 3.4 };
const view = { ...home };
let maxIterations = Number(iterationsInput.value);
let renderId = 0;

function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(box.width * ratio));
    canvas.height = Math.max(1, Math.round(box.height * ratio));
}

function escapeTime(real, imag) {
    let zr = 0;
    let zi = 0;
    let n = 0;

    while (n < maxIterations) {
        const zr2 = zr * zr - zi * zi + real;
        const zi2 = 2 * zr * zi + imag;
        zr = zr2;
        zi = zi2;
        if (zr * zr + zi * zi > 4) {
            const smooth = n + 1 - Math.log2(Math.log2(Math.sqrt(zr * zr + zi * zi)));
            return smooth;
        }
        n += 1;
    }
    return -1;
}

function colorFor(value) {
    if (value < 0) return [6, 5, 14];
    const t = Math.min(1, value / maxIterations);
    const r = Math.round(12 + 230 * Math.pow(t, 0.55));
    const g = Math.round(18 + 170 * Math.sin(t * Math.PI));
    const b = Math.round(40 + 180 * (1 - t));
    return [r, g, b];
}

async function paint() {
    const job = ++renderId;
    const width = canvas.width;
    const height = canvas.height;
    const image = ctx.createImageData(width, height);
    const pixels = image.data;
    const heightSpan = view.width * (height / width);
    const left = view.x - view.width / 2;
    const top = view.y + heightSpan / 2;
    const started = performance.now();

    statusNode.textContent = "Считаю…";

    for (let y = 0; y < height; y += 1) {
        if (job !== renderId) return;
        const imag = top - (y / height) * heightSpan;
        for (let x = 0; x < width; x += 1) {
            const real = left + (x / width) * view.width;
            const [r, g, b] = colorFor(escapeTime(real, imag));
            const offset = (y * width + x) * 4;
            pixels[offset] = r;
            pixels[offset + 1] = g;
            pixels[offset + 2] = b;
            pixels[offset + 3] = 255;
        }
        if (y % 12 === 0) {
            ctx.putImageData(image, 0, 0);
            statusNode.textContent = `Считаю… ${Math.round((y / height) * 100)}%`;
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }
    }

    if (job !== renderId) return;
    ctx.putImageData(image, 0, 0);
    const zoom = home.width / view.width;
    const elapsed = Math.round(performance.now() - started);
    statusNode.textContent = `${maxIterations} итераций · масштаб ×${zoom.toFixed(1)} · ${elapsed} мс`;
}

let queued = 0;
function requestPaint() {
    cancelAnimationFrame(queued);
    queued = requestAnimationFrame(() => {
        paint();
    });
}

function pointFromEvent(event) {
    const box = canvas.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width;
    const py = (event.clientY - box.top) / box.height;
    const heightSpan = view.width * (canvas.height / canvas.width);
    return {
        x: view.x - view.width / 2 + px * view.width,
        y: view.y + heightSpan / 2 - py * heightSpan,
    };
}

function zoomBy(factor, anchor) {
    const nextWidth = Math.min(8, Math.max(1e-12, view.width * factor));
    const applied = nextWidth / view.width;
    view.x = anchor.x + (view.x - anchor.x) * applied;
    view.y = anchor.y + (view.y - anchor.y) * applied;
    view.width = nextWidth;
    requestPaint();
}

iterationsInput.addEventListener("input", () => {
    maxIterations = Number(iterationsInput.value);
    iterationsLabel.textContent = String(maxIterations);
    requestPaint();
});

document.querySelector("#zoom-in").addEventListener("click", () => {
    zoomBy(0.65, { x: view.x, y: view.y });
});

document.querySelector("#zoom-out").addEventListener("click", () => {
    zoomBy(1 / 0.65, { x: view.x, y: view.y });
});

document.querySelector("#reset").addEventListener("click", () => {
    view.x = home.x;
    view.y = home.y;
    view.width = home.width;
    requestPaint();
});

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? 1.12 : 1 / 1.12, pointFromEvent(event));
}, { passive: false });

let drag = null;
canvas.addEventListener("pointerdown", (event) => {
    drag = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y };
    canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const box = canvas.getBoundingClientRect();
    const heightSpan = view.width * (canvas.height / canvas.width);
    view.x = drag.viewX - ((event.clientX - drag.x) / box.width) * view.width;
    view.y = drag.viewY + ((event.clientY - drag.y) / box.height) * heightSpan;
    requestPaint();
});

canvas.addEventListener("pointerup", () => {
    drag = null;
});

window.addEventListener("resize", () => {
    resize();
    requestPaint();
});

resize();
requestPaint();
