const canvas = document.getElementById("whiteboard");
const ctx = canvas.getContext("2d");

const nameInput = document.getElementById("name");
const joinBtn = document.getElementById("joinBtn");
const colorInput = document.getElementById("color");
const sizeInput = document.getElementById("size");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

let isDrawing = false;
let lastPoint = null;

let connection = null;
let myName = "";
let joined = false;

// ===== canvas sizing =====
function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
}
window.addEventListener("resize", () => resizeCanvasToDisplaySize());
resizeCanvasToDisplaySize();

// ===== coords =====
function getCanvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}

// ===== draw helper =====
function drawLine(from, to, color, size) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

function clearLocal() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
}

// ===== SignalR =====
async function startSignalR() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/whiteboardHub")
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

    connection.onreconnecting(() => {
        statusEl.textContent = "Reconnecting…";
    });

    connection.onreconnected(() => {
        statusEl.textContent = joined ? "Connected ✅ (Realtime)" : "Connected ✅ (Join to sync)";
        // After reconnect, request state again
        if (joined) connection.invoke("Join", myName).catch(console.error);
    });

    // receive 1 segment
    connection.on("ReceiveDraw", (data) => {
        drawLine(
            { x: data.fromX, y: data.fromY },
            { x: data.toX, y: data.toY },
            data.color || "#000",
            Number(data.size || 3)
        );
    });

    // receive clear
    connection.on("ReceiveClear", () => clearLocal());

    // receive joined ack
    connection.on("Joined", (info) => {
        statusEl.textContent = `Connected ✅ as ${info.userName}`;
    });

    // receive full board state
    connection.on("FullState", (segments) => {
        clearLocal();
        for (const s of segments) {
            drawLine(
                { x: s.fromX, y: s.fromY },
                { x: s.toX, y: s.toY },
                s.color || "#000",
                Number(s.size || 3)
            );
        }
    });

    try {
        await connection.start();
        statusEl.textContent = "Connected ✅ (Join to sync)";
    } catch (err) {
        console.error(err);
        statusEl.textContent = "Connection failed ❌";
    }
}

startSignalR();

// ===== Join button =====
joinBtn.addEventListener("click", async () => {
    if (!connection || connection.state !== "Connected") return;

    myName = (nameInput.value || "").trim();
    if (!myName) myName = "User-" + Math.floor(Math.random() * 1000);

    joined = true;
    await connection.invoke("Join", myName).catch(console.error);
    statusEl.textContent = "Syncing…";
});

// ===== send draw throttling (60fps) =====
let pendingSend = null;
let rafScheduled = false;

function queueSendDraw(payload) {
    if (!connection || connection.state !== "Connected" || !joined) return;

    // keep only the most recent segment per frame (simple + effective)
    pendingSend = payload;

    if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(() => {
            rafScheduled = false;
            if (!pendingSend) return;

            const toSend = pendingSend;
            pendingSend = null;

            connection.invoke("SendDraw", toSend).catch(console.error);
        });
    }
}

// ===== local drawing =====
function startDrawing(e) {
    if (!joined) return; // require join to participate (optional but cleaner)
    e.preventDefault();
    isDrawing = true;

    const p = getCanvasPointFromEvent(e);
    lastPoint = p;

    const payload = {
        fromX: p.x, fromY: p.y,
        toX: p.x, toY: p.y,
        color: colorInput.value,
        size: Number(sizeInput.value),
        userName: myName
    };

    drawLine(p, p, payload.color, payload.size);
    queueSendDraw(payload);
}

function drawMove(e) {
    if (!isDrawing || !joined) return;
    e.preventDefault();

    const p = getCanvasPointFromEvent(e);

    const payload = {
        fromX: lastPoint.x, fromY: lastPoint.y,
        toX: p.x, toY: p.y,
        color: colorInput.value,
        size: Number(sizeInput.value),
        userName: myName
    };

    drawLine(lastPoint, p, payload.color, payload.size);
    queueSendDraw(payload);

    lastPoint = p;
}

function stopDrawing(e) {
    if (!isDrawing) return;
    e.preventDefault();
    isDrawing = false;
    lastPoint = null;
}

// mouse
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", drawMove);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

// touch
canvas.addEventListener("touchstart", startDrawing, { passive: false });
canvas.addEventListener("touchmove", drawMove, { passive: false });
canvas.addEventListener("touchend", stopDrawing, { passive: false });

// clear (broadcast)
clearBtn.addEventListener("click", () => {
    clearLocal();
    if (connection && connection.state === "Connected") {
        connection.invoke("ClearBoard").catch(console.error);
    }
});