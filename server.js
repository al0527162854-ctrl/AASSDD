const http = require("http");

const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL; // מוגדר בשרת הראשון בלבד
const PEER_WAKE_URL = process.env.PEER_WAKE_URL;     // כתובת השרת השני בשרת הראשון, ולהפך
const TIME_ZONE = "Asia/Jerusalem";

const MAIL_INTERVAL_MS = 15000;      // כל 15 שניות בשרת הראשון
const WAKE_INTERVAL_MS = 600000;     // כל 10 דקות בין השרתים

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

async function mailLoop() {
  if (!APPS_SCRIPT_URL) return;
  await runProcessChatRequests();
  setTimeout(mailLoop, MAIL_INTERVAL_MS);
}

async function wakeLoop() {
  if (!PEER_WAKE_URL) return;
  await wakePeerServer();
  setTimeout(wakeLoop, WAKE_INTERVAL_MS);
}

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("OK");
  })
  .listen(PORT, () => {
    console.log("[" + getIsraelClockString() + " IL] Server listening on port", PORT);
    if (APPS_SCRIPT_URL) {
      mailLoop();
    }
    if (PEER_WAKE_URL) {
      wakeLoop();
    }
  });
