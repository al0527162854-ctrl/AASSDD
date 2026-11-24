const http = require("http");

const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const TIME_ZONE = "Asia/Jerusalem";

const MAIL_INTERVAL_MS = 4500; // כל 4 שניות בזמן פעילות
const IDLE_CHECK_MS = 60000;   // בדיקת שעון כל דקה בזמן חוסר פעילות

if (!APPS_SCRIPT_URL) {
  console.error("Missing APPS_SCRIPT_URL environment variable");
  process.exit(1);
}

function getIsraelTimeInfo() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);

  const weekdayStr = parts.find((p) => p.type === "weekday").value; // Sun, Mon, Tue, Wed, Thu, Fri, Sat
  const hour = Number(parts.find((p) => p.type === "hour").value) % 24;
  const minute = Number(parts.find((p) => p.type === "minute").value);
  const second = Number(parts.find((p) => p.type === "second").value);

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekdayStr];
  const mins = hour * 60 + minute;

  const clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  return { day, mins, clock };
}

// מחזיר true אם כרגע זמן מנוחה (לילה/הפסקות או שבת)
function isInactiveTime() {
  const { day, mins } = getIsraelTimeInfo();

  // 1. שמירת שבת: מיום שישי (5) בשעה 14:30 (870) עד מוצאי שבת (6) בשעה 20:30 (1230)
  if (day === 5 && mins >= 870) return true;
  if (day === 6 && mins < 1230) return true;

  // 2. חלונות חוסר פעילות יומיים:
  const inNightWindow = mins >= 60 && mins < 480;     // 01:00 עד 08:00
  const inMorningWindow = mins >= 570 && mins < 780;  // 09:30 עד 13:00
  const inEveningWindow = mins >= 960 && mins < 1140; // 16:00 עד 19:00

  return inNightWindow || inMorningWindow || inEveningWindow;
}

async function runProcessChatRequests() {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "GET",
      redirect: "follow"
    });
    const body = await res.text();
    const { clock } = getIsraelTimeInfo();
    console.log(`[${clock} IL] [MAIL] Status: ${res.status} | ${body}`);
  } catch (err) {
    const { clock } = getIsraelTimeInfo();
    console.error(`[${clock} IL] [MAIL] Error: ${err.message}`);
  }
}

async function mainLoop() {
  const { clock } = getIsraelTimeInfo();

  if (isInactiveTime()) {
    console.log(`[${clock} IL] [IDLE] Inactive/Shabbat window - sleeping...`);
    setTimeout(mainLoop, IDLE_CHECK_MS);
    return;
  }

  await runProcessChatRequests();
  
  // בדיקה נוספת לפני תזמון הריצה הבאה למקרה שנכנסנו כרגע לחלון שינה
  const nextDelay = isInactiveTime() ? IDLE_CHECK_MS : MAIL_INTERVAL_MS;
  setTimeout(mainLoop, nextDelay);
}

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("OK - Active");
  })
  .listen(PORT, () => {
    const { clock } = getIsraelTimeInfo();
    console.log(`[${clock} IL] Server listening on port ${PORT}`);
    mainLoop();
  });
