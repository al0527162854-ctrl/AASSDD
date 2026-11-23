const http = require("http");

const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const INTERVAL_MS = 10000; // כל 10 שניות

if (!APPS_SCRIPT_URL) {
  console.error("Missing APPS_SCRIPT_URL environment variable");
  process.exit(1);
}

async function runProcessChatRequests() {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "GET",
      redirect: "follow"
    });
    const body = await res.text();
    console.log(new Date().toISOString(), "Status:", res.status, body);
  } catch (err) {
    console.error(new Date().toISOString(), "Error:", err.message);
  }
}

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("OK");
  })
  .listen(PORT, () => {
    console.log("Server listening on port", PORT);
    runProcessChatRequests();
    setInterval(runProcessChatRequests, INTERVAL_MS);
  });