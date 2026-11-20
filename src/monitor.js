
import { config } from "./config.js";

import {
  getSnapshotInputs,
  getBasis,
  errorText
} from "./binance.js";

import { analyzeOrderBook } from "./orderBook.js";

import {
  getCoin,
  getCoins,
  updateCoin
} from "./storage.js";

import { formatReport } from "./formatter.js";

import { checkBasisAlert } from "./alerts/basisAlert.js";

import {
  calculatePriceChange,
  checkPriceAlert
} from "./alerts/priceAlert.js";

import {
  calculateImbalanceChange,
  checkImbalanceAlert
} from "./alerts/imbalanceAlert.js";

import { createBasisChart } from "./charts/basisChart.js";
import { createPriceChart } from "./charts/priceChart.js";
import { sendPhoto } from "./telegramApi.js";

// ==========================================
// MONITOR STATE
// ==========================================

let scanning = false;
let timer = null;
let sendAlert = null;

export function isScanning() {
  return scanning;
}

// ==========================================
// HELPERS
// ==========================================

function toBasisPercent(basis) {
  if (basis?.basisRate == null) return null;

  const value = Number(basis.basisRate);

  return Number.isFinite(value)
    ? value * 100
    : null;
}

export async function fetchSnapshot(symbol) {
  const { book, price } = await getSnapshotInputs(symbol);

  return analyzeOrderBook(symbol, book, price);
}

export async function fetchFullReport(symbol) {
  const [snapshotResult, basisResult] =
    await Promise.allSettled([
      fetchSnapshot(symbol),
      getBasis(symbol)
    ]);

  if (snapshotResult.status === "rejected") {
    throw snapshotResult.reason;
  }

  const basis =
    basisResult.status === "fulfilled"
      ? basisResult.value
      : null;

  if (basisResult.status === "rejected") {
    console.error(
      `[BASIS] ${symbol}:`,
      errorText(basisResult.reason)
    );
  }

  return formatReport(snapshotResult.value, basis);
}

// ==========================================
// CHECK RECORD
// ==========================================

function unchangedRecord(symbol, record) {
  const latest = getCoin(symbol);

  if (!latest || latest.paused) return null;

  if (
    latest.baseline !== record.baseline ||
    latest.basisBaseline !== record.basisBaseline ||
    latest.priceBaseline !== record.priceBaseline
  ) {
    return null;
  }

  return latest;
}

// ==========================================
// SEND CHARTS
// ==========================================

async function sendTriggeredCharts(
  symbol,
  flags,
  snapshot,
  priceBaseline
) {
  const jobs = [
    {
      type: "BASIS RATE",
      active: flags.basisTriggered,
      make: () => createBasisChart(symbol)
    },
    {
      type: "PRICE PUMP + ORDER BOOK",
      active:
        flags.priceTriggered ||
        flags.imbalanceTriggered,
      make: () => createPriceChart(
        symbol,
        priceBaseline,
        snapshot
      )
    }
  ];

  for (const job of jobs) {
    if (!job.active) continue;

    try {
      const png = await job.make();

      await sendPhoto(png, {
  caption: `📊 ${symbol} | ${job.type}`,

  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "📋 Danh sách coin",
          callback_data: "menu:list"
        }
      ]
    ]
  }
});

      console.log(
        `[CHART SENT] ${symbol} | ${job.type}`
      );
    } catch (error) {
      console.error(
        `[CHART ERROR] ${symbol} | ${job.type}:`,
        errorText(error)
      );
    }
  }
}

// ==========================================
// SCAN ONE COIN
// ==========================================

async function scanCoin(symbol) {
  const record = getCoin(symbol);

  if (!record || record.paused) return;

  // ========================================
  // FETCH DATA
  // ========================================

  const [snapshotResult, basisResult] =
    await Promise.allSettled([
      fetchSnapshot(symbol),
      getBasis(symbol)
    ]);

  const snapshot =
    snapshotResult.status === "fulfilled"
      ? snapshotResult.value
      : null;

  const basis =
    basisResult.status === "fulfilled"
      ? basisResult.value
      : null;

  if (snapshotResult.status === "rejected") {
    console.error(
      `[ORDER BOOK] ${symbol}:`,
      errorText(snapshotResult.reason)
    );
  }

  if (basisResult.status === "rejected") {
    console.error(
      `[BASIS] ${symbol}:`,
      errorText(basisResult.reason)
    );
  }

  // ========================================
  // IMBALANCE
  // ========================================

  const currentBasisRate = toBasisPercent(basis);

  const imbalanceBaseline = Number(record.baseline);

  const imbalanceChange = snapshot
    ? calculateImbalanceChange(
        snapshot.imbalance,
        imbalanceBaseline
      )
    : null;

  const imbalanceTriggered = snapshot
    ? checkImbalanceAlert(
        imbalanceChange,
        config.threshold
      )
    : false;

  // ========================================
  // BASIS RATE
  // ========================================

  const oldBasis = record.basisBaseline;

  const basisBaseline =
    oldBasis != null &&
    Number.isFinite(Number(oldBasis))
      ? Number(oldBasis)
      : null;

  const basisChange =
    currentBasisRate != null &&
    basisBaseline != null
      ? currentBasisRate - basisBaseline
      : null;

  const basisTriggered =
    currentBasisRate != null
      ? checkBasisAlert(currentBasisRate)
      : false;

  // ========================================
  // PRICE PUMP
  // ========================================

  const rawPriceBaseline = record.priceBaseline;

  const priceBaseline =
    rawPriceBaseline != null &&
    Number.isFinite(Number(rawPriceBaseline)) &&
    Number(rawPriceBaseline) > 0
      ? Number(rawPriceBaseline)
      : null;

  const currentPrice = snapshot?.currentPrice ?? null;

  const priceChange = calculatePriceChange(
    currentPrice,
    priceBaseline
  );

  const priceTriggered = snapshot
    ? checkPriceAlert(
        priceChange,
        config.priceThreshold ?? 10
      )
    : false;

  // ========================================
  // ALERT CONDITIONS
  // ========================================

  const shouldAlert =
    imbalanceTriggered ||
    basisTriggered ||
    priceTriggered;

  console.log(
    `[SCAN] ${symbol} | ` +
    `Imbalance=${snapshot?.imbalance?.toFixed(2) ?? "N/A"}% | ` +
    `Imbalance Change=${imbalanceChange?.toFixed(2) ?? "N/A"}pp | ` +
    `Basis=${currentBasisRate?.toFixed(2) ?? "N/A"}% | ` +
    `Basis Change=${basisChange?.toFixed(2) ?? "N/A"}pp | ` +
    `Price=${currentPrice ?? "N/A"} | ` +
    `Price Change=${priceChange?.toFixed(2) ?? "N/A"}% | ` +
    `Alert=${shouldAlert}`
  );

  // ========================================
  // SEND ALERT
  // ========================================

  if (shouldAlert) {
    if (
      !snapshot ||
      !unchangedRecord(symbol, record)
    ) {
      return;
    }

    // ======================================
    // OPTIONAL TEXT ALERT
    // ======================================

    if (config.sendAlertText) {
      const report = formatReport(
        snapshot,
        basis,
        {
          alert: true,
          imbalanceTriggered,
          basisTriggered,
          priceTriggered,
          imbalanceChange,
          basisChange,
          priceChange,
          imbalanceBaseline,
          basisBaseline,
          priceBaseline,
          currentPrice
        }
      );

      if (typeof sendAlert !== "function") {
        throw new Error(
          "Monitor chưa có hàm gửi Telegram"
        );
      }

      await sendAlert(report);

      console.log(
        `[TEXT SENT] ${symbol} | MARKET FLOW`
      );
    } else {
      console.log(
        `[TEXT SKIPPED] ${symbol} | SEND_ALERT_TEXT=false`
      );
    }

    // ======================================
    // SEND TRIGGERED CHARTS
    // ======================================

    await sendTriggeredCharts(
      symbol,
      {
        basisTriggered,
        priceTriggered,
        imbalanceTriggered
      },
      snapshot,
      priceBaseline
    );

    // ======================================
    // UPDATE BASELINES
    // ======================================

    const afterSend = unchangedRecord(
      symbol,
      record
    );

    if (afterSend) {
      updateCoin(symbol, {
        baseline: snapshot.imbalance,

        basisBaseline:
          currentBasisRate ?? basisBaseline,

        // Không reset priceBaseline
        lastPrice: currentPrice,
        lastImbalance: snapshot.imbalance,
        lastBasisRate: currentBasisRate,
        lastScanAt: snapshot.timestamp,
        lastAlertAt: Date.now(),

        alertCount:
          (afterSend.alertCount || 0) + 1
      });
    }

    console.log(
      `[ALERT] ${symbol} | ` +
      `Imbalance=${imbalanceTriggered} | ` +
      `Basis=${basisTriggered} | ` +
      `Price=${priceTriggered}`
    );

    return;
  }

  // ========================================
  // NO ALERT - UPDATE LATEST DATA
  // ========================================

  if (!unchangedRecord(symbol, record)) return;

  const changes = {
    lastScanAt: Date.now()
  };

  if (snapshot) {
    changes.lastImbalance = snapshot.imbalance;
    changes.lastPrice = snapshot.currentPrice;
  }

  if (currentBasisRate != null) {
    changes.lastBasisRate = currentBasisRate;

    if (basisBaseline == null) {
      changes.basisBaseline = currentBasisRate;
    }
  }

  updateCoin(symbol, changes);
}

// ==========================================
// SCAN ALL COINS
// ==========================================

export async function scanAll() {
  if (scanning) {
    console.log(
      "[MONITOR] Bỏ qua chu kỳ quét chồng"
    );
    return;
  }

  scanning = true;

  try {
    const coins = getCoins().filter(
      coin => !coin.paused
    );

    if (!coins.length) return;

    console.log(
      `[MONITOR] Quét ${coins.length} coin`
    );

    for (const coin of coins) {
      try {
        await scanCoin(coin.symbol);
      } catch (error) {
        console.error(
          `[SCAN ERROR] ${coin.symbol}:`,
          errorText(error)
        );
      }
    }
  } finally {
    scanning = false;
  }
}

// ==========================================
// START MONITOR
// ==========================================

export function startMonitor(sendMessage) {
  if (timer) return;

  sendAlert = sendMessage;

  const scheduleNext = () => {
    const now = Date.now();

    const intervalMs =
      config.intervalMinutes * 60 * 1000;

    const offsetMinutes =
      config.scanOffsetMinutes %
      config.intervalMinutes;

    const offsetMs =
      offsetMinutes * 60 * 1000;

    const nextScan =
      Math.floor(
        (now - offsetMs) / intervalMs + 1
      ) * intervalMs + offsetMs;

    const delay = nextScan - now;

    console.log(
      `[MONITOR] Next scan: ${
        new Date(nextScan).toLocaleString(
          "vi-VN",
          {
            timeZone: "Asia/Ho_Chi_Minh",
            hour12: false
          }
        )
      }`
    );

    timer = setTimeout(async () => {
      try {
        await scanAll();
      } catch (error) {
        console.error(
          "[MONITOR ERROR]",
          errorText(error)
        );
      } finally {
        if (timer) {
          scheduleNext();
        }
      }
    }, delay);
  };

  scheduleNext();

  console.log(
    `[MONITOR] Scan interval: ${config.intervalMinutes} minutes`
  );

  console.log(
    `[MONITOR] Scan offset: ${config.scanOffsetMinutes} minutes`
  );

  console.log(
    `[MONITOR] Imbalance threshold: ${config.threshold} pp`
  );

  console.log(
    `[MONITOR] Basis Rate: ${config.basisAlertMin}% to ${config.basisAlertMax}%`
  );

  console.log(
    `[MONITOR] Price Pump threshold: ${config.priceThreshold}%`
  );

  console.log(
    `[MONITOR] SEND_ALERT_TEXT=${config.sendAlertText}`
  );

  console.log(
    "[MONITOR] Alert logic: OR"
  );
}

// ==========================================
// STOP MONITOR
// ==========================================

export function stopMonitor() {
  if (timer) {
    clearTimeout(timer);
  }

  timer = null;
}
