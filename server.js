const http = require("http");

const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL; // אופציונלי אם השרת משמש רק להעיר שרת אחר
const PEER_WAKE_URL = process.env.PEER_WAKE_URL;     // כתובת השרת השני ב-Render להערה (אופציונלי)
const TIME_ZONE = "Asia/Jerusalem";

const FAST_INTERVAL_MS = 10000;  // כל 10 שניות
const SLOW_INTERVAL_MS = 60000;  // כל דקה אחת
const WAKE_PEER_INTERVAL_MS = 60000; // מרווח הערת שרת עמית (ברירת מחדל: כל דקה)

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

function isSlowMinuteSchedule() {
  const mins = getIsraelMinutesSinceMidnight();

  // 01:00 (60) עד 08:30 (510)
  const inNightWindow = mins >= 60 && mins < 510;

  // 09:30 (570) עד 13:00 (780)
  const inMorningWindow = mins >= 570 && mins < 780;

  // 16:00 (960) עד 19:00 (1140)
  const inEveningWindow = mins >= 960 && mins < 1140;

  return inNightWindow || inMorningWindow || inEveningWindow;
}

function getCurrentIntervalMs() {
  return isSlowMinuteSchedule() ? SLOW_INTERVAL_MS : FAST_INTERVAL_MS;
}

async function runProcessChatRequests() {
  if (!APPS_SCRIPT_URL) {
    return;
  }

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
  if (!PEER_WAKE_URL) {
    return;
  }

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

async function mailLoop() {
  if (APPS_SCRIPT_URL) {
    await runProcessChatRequests();
    const nextDelay = getCurrentIntervalMs();
    console.log(
      new Date().toISOString(),
      "[SCHEDULE] Next mail poll in",
      nextDelay / 1000,
      "sec"
    );
    setTimeout(mailLoop, nextDelay);
  }
}

async function wakeLoop() {
  if (PEER_WAKE_URL) {
    await wakePeerServer();
    setTimeout(wakeLoop, WAKE_PEER_INTERVAL_MS);
  }
}

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("OK");
  })
  .listen(PORT, () => {
    console.log("Server listening on port", PORT);
    if (APPS_SCRIPT_URL) {
      mailLoop();
    }
    if (PEER_WAKE_URL) {
      wakeLoop();
    }
  });
