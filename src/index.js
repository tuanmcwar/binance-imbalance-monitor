
import { config } from "./config.js";
import { loadState, getCoins } from "./storage.js";

import {
  startMonitor,
  stopMonitor
} from "./monitor.js";

import {
  startTelegram,
  stopTelegram,
  sendReport
} from "./telegram.js";

let shuttingDown = false;

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 BINANCE IMBALANCE MONITOR V2");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  loadState();

  const coins = getCoins();

  console.log(`📚 ORDER BOOK: ±${config.rangePercent}%`);
  console.log(`📊 DEPTH LIMIT: ${config.depthLimit}`);
  console.log(`⏱ SCAN INTERVAL: ${config.intervalMinutes} phút`);
  console.log(`🚨 THRESHOLD: > ${config.threshold} điểm %`);
  console.log(`🪙 MONITORED COINS: ${coins.length}`);

 startMonitor(sendReport);

  console.log("📡 BINANCE MONITOR: STARTED");
  console.log("🤖 TELEGRAM: STARTING");

  await startTelegram();
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n[${signal}] Shutting down...`);

  stopMonitor();
  stopTelegram();

  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch(error => {
  console.error("[FATAL]", error.message);
  process.exit(1);
});

