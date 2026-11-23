const http = require("http");

const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL; // מוגדר בשרת הראשון בלבד
const PEER_WAKE_URL = process.env.PEER_WAKE_URL;     // כתובת השרת השני בשרת הראשון, ולהפך
const TIME_ZONE = "Asia/Jerusalem";

const MAIL_INTERVAL_MS = 15000;      // כל 15 שניות בזמן פעילות
const WAKE_INTERVAL_MS = 600000;     // כל 10 דקות בין השרתים בזמן פעילות
const IDLE_CHECK_MS = 60000;         // בדיקת שעון כל דקה בזמן חלון רדום

if (!APPS_SCRIPT_URL && !PEER_WAKE_URL) {
  console.error("Missing APPS_SCRIPT_URL or PEER_WAKE_URL environment variable");
  process.exit(1);
}

function getIsraelClockString() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date());
}

function getIsraelMinutesSinceMidnight() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  return hour * 60 + minute;
}

// שעות חוסר פעילות ("רדומות") — ללא קריאות וללא הערה הדדית
function isInactiveWindow() {
  const mins = getIsraelMinutesSinceMidnight();

  // 01:00 (60) עד 08:00 (480)
  const inNightWindow = mins >= 60 && mins < 480;

  // 09:30 (570) עד 13:00 (780)
  const inMorningWindow = mins >= 570 && mins < 780;

  // 16:00 (960) עד 19:00 (1140)
  const inEveningWindow = mins >= 960 && mins < 1140;

  return inNightWindow || inMorningWindow || inEveningWindow;
}

async function runProcessChatRequests() {
  if (!APPS_SCRIPT_URL) return;

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "GET",
      redirect: "follow"
    });
    const body = await res.text();
    console.log("[" + getIsraelClockString() + " IL] [MAIL] Status:", res.status, body);
  } catch (err) {
    console.error("[" + getIsraelClockString() + " IL] [MAIL] Error:", err.message);
  }
}

async function wakePeerServer() {
  if (!PEER_WAKE_URL) return;

  try {
    const res = await fetch(PEER_WAKE_URL, {
      method: "GET",
      redirect: "follow"
    });
    console.log("[" + getIsraelClockString() + " IL] [WAKE] Peer status:", res.status);
  } catch (err) {
    console.error("[" + getIsraelClockString() + " IL] [WAKE] Peer error:", err.message);
  }
}

let mailTimer = null;
let wakeTimer = null;
let idleTimer = null;
let loopsRunning = false;

function clearScheduledTimers() {
  if (mailTimer) clearTimeout(mailTimer);
  if (wakeTimer) clearTimeout(wakeTimer);
  if (idleTimer) clearTimeout(idleTimer);
  mailTimer = null;
  wakeTimer = null;
  idleTimer = null;
}

async function mailLoop() {
  if (!loopsRunning || !APPS_SCRIPT_URL || isInactiveWindow()) {
    loopsRunning = false;
    scheduleCoordinator();
    return;
  }

  await runProcessChatRequests();
  if (!loopsRunning || isInactiveWindow()) {
    loopsRunning = false;
    scheduleCoordinator();
    return;
  }

  mailTimer = setTimeout(mailLoop, MAIL_INTERVAL_MS);
}

async function wakeLoop() {
  if (!loopsRunning || !PEER_WAKE_URL || isInactiveWindow()) {
    loopsRunning = false;
    scheduleCoordinator();
    return;
  }

  await wakePeerServer();
  if (!loopsRunning || isInactiveWindow()) {
    loopsRunning = false;
    scheduleCoordinator();
    return;
  }

  wakeTimer = setTimeout(wakeLoop, WAKE_INTERVAL_MS);
}

function scheduleCoordinator() {
  clearScheduledTimers();

  if (isInactiveWindow()) {
    loopsRunning = false;
    console.log("[" + getIsraelClockString() + " IL] [IDLE] Inactive window - skipping mail & peer wake");
    idleTimer = setTimeout(scheduleCoordinator, IDLE_CHECK_MS);
    return;
  }

  if (!loopsRunning) {
    loopsRunning = true;
    console.log("[" + getIsraelClockString() + " IL] [ACTIVE] Starting active loops");
    if (APPS_SCRIPT_URL) mailLoop();
    if (PEER_WAKE_URL) wakeLoop();
  }
}

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("OK");
  })
  .listen(PORT, () => {
    console.log("[" + getIsraelClockString() + " IL] Server listening on port", PORT);
    scheduleCoordinator();
  });
