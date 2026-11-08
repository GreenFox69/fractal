/* =========================================================
   Фрактал Мандельброта — логика вычислений и отрисовки
   Запуск: python3 -m http.server 8000 --bind 127.0.0.1
   Затем открыть http://127.0.0.1:8000
   ========================================================= */

(() => {
    "use strict";

    const canvas = document.getElementById("fractal-canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    const hud = document.getElementById("hud");

    const slider = document.getElementById("iterations");
    const sliderOutput = document.getElementById("iterations-value");
    const btnReset = document.getElementById("btn-reset");
    const btnZoomIn = document.getElementById("btn-zoom-in");
    const btnZoomOut = document.getElementById("btn-zoom-out");

    // --- Вид (комплексная плоскость) ---
    const DEFAULT_VIEW = { cx: -0.6, cy: 0.0, scale: 3.2 }; // scale = ширина в комплексных единицах
    let view = { ...DEFAULT_VIEW };

    let maxIterations = parseInt(slider.value, 10);

    // --- Палитра цветов (предвычислим LUT для скорости) ---
    const PALETTE_SIZE = 2048;
    const palette = new Uint8ClampedArray(PALETTE_SIZE * 3);
    (function buildPalette() {
        for (let i = 0; i < PALETTE_SIZE; i++) {
            const t = i / PALETTE_SIZE;
            // Красивый градиент: тёмно-синий -> фиолетовый -> розовый -> оранжевый -> белый
            const r = Math.floor(255 * Math.min(1, 4.2 * t));
            const g = Math.floor(255 * Math.max(0, Math.min(1, 4.2 * t - 1.1)));
            const b = Math.floor(255 * (0.5 + 0.5 * Math.cos(2 * Math.PI * t)) * Math.min(1, 1.6 * t + 0.15));
            palette[i * 3] = r;
            palette[i * 3 + 1] = g;
            palette[i * 3 + 2] = b === 0 ? 40 : b; // лёгкий синий оттенок у тёмных тонов
        }
    })();

    // --- Размер канваса (с учётом DPR, но ограничим для производительности) ---
    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
    }

    // --- Ядро: значение итерации для одной точки (smooth iteration) ---
    function mandelIter(cxr, cyi) {
        let zr = 0, zi = 0;
        let zr2 = 0, zi2 = 0;
        let iter = 0;

        while (zr2 + zi2 <= 4 && iter < maxIterations) {
            zi = 2 * zr * zi + cyi;
            zr = zr2 - zi2 + cxr;
            zr2 = zr * zr;
            zi2 = zi * zi;
            iter++;
        }

        if (iter >= maxIterations) return -1; // точка внутри множества

        // Сглаживание: нормализованная «непрерывная» итерация
        const logZn = Math.log(zr2 + zi2) / 2;
        const nu = Math.log(logZn / Math.LN2) / Math.LN2;
        return iter + 1 - nu;
    }

    // --- Отрисовка построчно с дебаунсом и индикатором прогресса ---
    let renderToken = 0;

    async function render() {
        const token = ++renderToken;
        const w = canvas.width;
        const h = canvas.height;

        const aspect = w / h;
        const scaleX = view.scale;
        const scaleY = view.scale / aspect;

        const x0 = view.cx - scaleX / 2;
        const y0 = view.cy + scaleY / 2;

        const img = ctx.createImageData(w, h);
        const data = img.data;

        const stepX = scaleX / w;
        const stepY = scaleY / h;

        const startTime = performance.now();
        const CHUNK_ROWS = 8; // строк за кадр — интерфейс не подвисает

        hud.style.opacity = "1";
        hud.textContent = "Расчёт…";

        for (let py = 0; py < h; py += CHUNK_ROWS) {
            if (token !== renderToken) return; // новый рендер отменил этот

            const yEnd = Math.min(py + CHUNK_ROWS, h);
            for (let y = py; y < yEnd; y++) {
                const cyi = y0 - y * stepY;
                let idx = (y * w) * 4;
                for (let x = 0; x < w; x++, idx += 4) {
                    const cxr = x0 + x * stepX;
                    const v = mandelIter(cxr, cyi);

                    if (v === -1) {
                        data[idx] = 5;
                        data[idx + 1] = 5;
                        data[idx + 2] = 12;
                    } else {
                        // Логарифмическое отображение итераций в индекс палитры
                        const norm = Math.log(v + 1) / Math.log(maxIterations + 1);
                        const p = Math.min(PALETTE_SIZE - 1, (norm * PALETTE_SIZE) | 0) * 3;
                        data[idx] = palette[p];
                        data[idx + 1] = palette[p + 1];
                        data[idx + 2] = palette[p + 2];
                    }
                    data[idx + 3] = 255;
                }
            }

            ctx.putImageData(img, 0, 0);

            const pct = Math.round((yEnd / h) * 100);
            hud.textContent = `Расчёт… ${pct}%`;
            await new Promise(r => requestAnimationFrame(r));
        }

        if (token !== renderToken) return;
        const ms = Math.round(performance.now() - startTime);
        hud.textContent = `Итерации: ${maxIterations} • Zoom: ×${(DEFAULT_VIEW.scale / view.scale).toFixed(1)} • ${ms} мс`;
    }

    // --- Преобразование экранных координат в комплексные ---
    function screenToComplex(px, py) {
        const rect = canvas.getBoundingClientRect();
        const dpr = canvas.width / rect.width;
        const x = px * dpr;
        const y = py * dpr;

        const aspect = canvas.width / canvas.height;
        const scaleX = view.scale;
        const scaleY = view.scale / aspect;
        const x0 = view.cx - scaleX / 2;
        const y0 = view.cy + scaleY / 2;

        return {
            re: x0 + x * (scaleX / canvas.width),
            im: y0 - y * (scaleY / canvas.height),
        };
    }

    function zoomAt(factor, clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const target = screenToComplex(clientX - rect.left, clientY - rect.top);

        view.scale *= factor;
        view.scale = Math.max(1e-13, Math.min(6, view.scale));

        // Сохраняем точку под курсором на месте
        view.cx = target.re + (view.cx - target.re) * factor;
        view.cy = target.im + (view.cy - target.im) * factor;

        scheduleRender();
    }

    // --- Дебаунс рендера ---
    let renderTimer = null;
    function scheduleRender(delay = 60) {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(render, delay);
    }

    // --- События: ползунок ---
    slider.addEventListener("input", () => {
        maxIterations = parseInt(slider.value, 10);
        sliderOutput.textContent = maxIterations;
        scheduleRender(120);
    });

    // --- События: кнопки ---
    btnReset.addEventListener("click", () => {
        view = { ...DEFAULT_VIEW };
        scheduleRender(0);
    });

    btnZoomIn.addEventListener("click", () => {
        const rect = canvas.getBoundingClientRect();
        zoomAt(0.6, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    btnZoomOut.addEventListener("click", () => {
        const rect = canvas.getBoundingClientRect();
        zoomAt(1 / 0.6, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    // --- Колесо мыши: масштаб к курсору ---
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });

    // --- Двойной клик: приблизить к точке ---
    canvas.addEventListener("dblclick", (e) => {
        zoomAt(0.4, e.clientX, e.clientY);
    });

    // --- Перетаскивание: панорамирование ---
    let dragging = false;
    let lastX = 0, lastY = 0;

    canvas.addEventListener("pointerdown", (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        const unitsPerPxX = view.scale / rect.width;
        const unitsPerPxY = (view.scale / (canvas.width / canvas.height)) / rect.height;

        view.cx -= (e.clientX - lastX) * unitsPerPxX;
        view.cy += (e.clientY - lastY) * unitsPerPxY;
        lastX = e.clientX;
        lastY = e.clientY;

        scheduleRender(30);
    });

    const endDrag = (e) => {
        if (dragging) {
            dragging = false;
            try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        }
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    // --- Ресайз окна ---
    window.addEventListener("resize", () => {
        resizeCanvas();
        scheduleRender(150);
    });

    // --- Старт ---
    resizeCanvas();
    render();
})();
