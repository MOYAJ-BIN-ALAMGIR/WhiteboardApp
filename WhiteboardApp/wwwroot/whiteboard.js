// ====== Canvas setup ======
const canvas = document.getElementById("whiteboard");
const ctx = canvas.getContext("2d");

const colorInput = document.getElementById("color");
const sizeInput = document.getElementById("size");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

let isDrawing = false;
let lastPoint = null;

// ====== Make canvas crisp ======
function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    // scale drawing coords to CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
}

window.addEventListener("resize", () => {
    // NOTE: resizing clears canvas; later we can store strokes if needed
    resizeCanvasToDisplaySize();
});

resizeCanvasToDisplaySize();

// ====== Coordinate helper ======
function getCanvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return { x: clientX - rect.left, y: clientY - rect.top };
}

// ====== Draw line helper ======
function drawLine(from, to, color, size) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

// ====== SignalR connection ======
let connection = null;

async function startSignalR() {
    if (!window.signalR) {
        statusEl.textContent = "SignalR client missing ❌";
        return;
    }

    connection = new signalR.HubConnectionBuilder()
        .withUrl("/whiteboardHub")
        .configureLogging(signalR.LogLevel.Information)
        .withAutomaticReconnect()
        .build();

    // Receive remote draw events
    connection.on("ReceiveDraw", (data) => {
        // data: { fromX, fromY, toX, toY, color, size, isStart }
        drawLine(
            { x: data.fromX, y: data.fromY },
            { x: data.toX, y: data.toY },
            data.color || "#000000",
            Number(data.size || 3)
        );
    });

    // Receive remote clear
    connection.on("ReceiveClear", () => clearLocal());

    try {
        await connection.start();
        statusEl.textContent = "Connected ✅ (Realtime)";
    } catch (err) {
        console.error("SignalR connect error:", err);
        statusEl.textContent = "Connection failed ❌";
    }
}

startSignalR();

// ====== Send helper (safe) ======
function sendDraw(from, to, isStart) {
    if (!connection || connection.state !== "Connected") return;

    const payload = {
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        color: colorInput.value,
        size: Number(sizeInput.value),
        isStart: !!isStart
    };

    connection.invoke("SendDraw", payload).catch(console.error);
}

// ====== Local drawing functions ======
function startDrawing(e) {
    e.preventDefault();
    isDrawing = true;

    const p = getCanvasPointFromEvent(e);
    lastPoint = p;

    // draw dot locally
    drawLine(p, p, colorInput.value, Number(sizeInput.value));

    // send dot as a tiny line
    sendDraw(p, p, true);
}

function drawMove(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const p = getCanvasPointFromEvent(e);

    // draw locally
    drawLine(lastPoint, p, colorInput.value, Number(sizeInput.value));

    // send to others
    sendDraw(lastPoint, p, false);

    lastPoint = p;
}

function stopDrawing(e) {
    if (!isDrawing) return;
    e.preventDefault();

    isDrawing = false;
    lastPoint = null;
}

// ====== Clear (local + broadcast) ======
function clearLocal() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
}

clearBtn.addEventListener("click", () => {
    clearLocal();
    if (connection && connection.state === "Connected") {
        connection.invoke("ClearBoard").catch(console.error);
    }
});

// ====== Mouse events ======
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", drawMove);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

// ====== Touch events ======
canvas.addEventListener("touchstart", startDrawing, { passive: false });
canvas.addEventListener("touchmove", drawMove, { passive: false });
canvas.addEventListener("touchend", stopDrawing, { passive: false });
