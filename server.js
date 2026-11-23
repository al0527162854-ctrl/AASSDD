const http = require("http");

const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const PEER_WAKE_URL = process.env.PEER_WAKE_URL;
const TIME_ZONE = "Asia/Jerusalem";

const ACTIVE_INTERVAL_MS = 300000; // כל 5 דקות (5 * 60 * 1000 מ"ש)
const IDLE_CHECK_MS = 60000;       // בדיקת שעון כל דקה בזמן חוסר פעילות

if (!APPS_SCRIPT_URL && !PEER_WAKE_URL) {
  console.error("Missing APPS_SCRIPT_URL or PEER_WAKE_URL environment variable");
  process.exit(1);
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

// שעות שבהן אין קריאות ואין הערה מ-Render (עד 08:00 בבוקר)
function isInactiveWindow() {
  const mins = getIsraelMinutesSinceMidnight();

  // 01:00 (60) עד 08:00 (480) — מתעורר וחוזר לפעול ב-08:00
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
    console.log(new Date().toISOString(), "[MAIL] Status:", res.status, body);
  } catch (err) {
    console.error(new Date().toISOString(), "[MAIL] Error:", err.message);
  }
}

async function wakePeerServer() {
  if (!PEER_WAKE_URL) return;

  try {
    const res = await fetch(PEER_WAKE_URL, {
      method: "GET",
      redirect: "follow"
    });
    console.log(new Date().toISOString(), "[WAKE] Peer status:", res.status);
  } catch (err) {
    console.error(new Date().toISOString(), "[WAKE] Peer error:", err.message);
  }
}

async function activeTick() {
  if (isInactiveWindow()) {
    console.log(new Date().toISOString(), "[IDLE] Inactive window - no mail/wake calls");
    setTimeout(activeTick, IDLE_CHECK_MS);
    return;
  }

  await Promise.all([runProcessChatRequests(), wakePeerServer()]);
  setTimeout(activeTick, ACTIVE_INTERVAL_MS);
}

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("OK");
  })
  .listen(PORT, () => {
    console.log("Server listening on port", PORT);
    activeTick();
  });
