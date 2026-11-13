
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

let scanning = false;
let timer = null;
let sendAlert = null;

export function isScanning() {
  return scanning;
}

function toBasisPercent(basis) {
  if (basis?.basisRate == null) return null;

  const value = Number(basis.basisRate);
  return Number.isFinite(value) ? value * 100 : null;
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

  const basis = basisResult.status === "fulfilled"
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

async function scanCoin(symbol) {
  const record = getCoin(symbol);

  if (!record || record.paused) return;

  const [snapshotResult, basisResult] =
    await Promise.allSettled([
      fetchSnapshot(symbol),
      getBasis(symbol)
    ]);

  const snapshot = snapshotResult.status === "fulfilled"
    ? snapshotResult.value
    : null;

  const basis = basisResult.status === "fulfilled"
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

  const currentBasisRate = toBasisPercent(basis);

  const imbalanceBaseline = Number(record.baseline);

  const imbalanceChange =
    snapshot && Number.isFinite(imbalanceBaseline)
      ? snapshot.imbalance - imbalanceBaseline
      : null;

  const oldBasis = record.basisBaseline;

  const basisBaseline =
    oldBasis != null && Number.isFinite(Number(oldBasis))
      ? Number(oldBasis)
      : null;

  const basisChange =
    currentBasisRate != null && basisBaseline != null
      ? currentBasisRate - basisBaseline
      : null;

  const imbalanceTriggered =
    imbalanceChange != null &&
    Math.abs(imbalanceChange) > config.threshold;

  const basisTriggered =
    basisChange != null &&
    Math.abs(basisChange) >= config.basisThreshold;

  console.log(
    `[SCAN] ${symbol} | ` +
    `Imbalance=${snapshot?.imbalance?.toFixed(2) ?? "N/A"}% | ` +
    `Imbalance Change=${imbalanceChange?.toFixed(2) ?? "N/A"}pp | ` +
    `Basis=${currentBasisRate?.toFixed(2) ?? "N/A"}% | ` +
    `Basis Change=${basisChange?.toFixed(2) ?? "N/A"}pp | ` +
    `Alert=${imbalanceTriggered || basisTriggered}`
  );

  // Nếu một trong hai điều kiện thỏa mãn thì báo.
  if (imbalanceTriggered || basisTriggered) {
    // Báo cáo yêu cầu ORDER BOOK đầy đủ.
    // Nếu thiếu snapshot, đợi lần quét tiếp theo.
    if (!snapshot) return;

    const latest = getCoin(symbol);

    if (
      !latest ||
      latest.paused ||
      latest.baseline !== record.baseline ||
      latest.basisBaseline !== record.basisBaseline
    ) {
      return;
    }

    const report = formatReport(snapshot, basis, {
      alert: true,
      imbalanceTriggered,
      basisTriggered,
      imbalanceChange,
      basisChange,
      imbalanceBaseline,
      basisBaseline
    });

    // Nếu Telegram gửi thất bại thì giữ mốc cũ.
    await sendAlert(report);

    const afterSend = getCoin(symbol);

    if (
      afterSend &&
      !afterSend.paused &&
      afterSend.baseline === record.baseline &&
      afterSend.basisBaseline === record.basisBaseline
    ) {
      updateCoin(symbol, {
        baseline: snapshot.imbalance,
        basisBaseline:
          currentBasisRate ?? basisBaseline,
        lastImbalance: snapshot.imbalance,
        lastBasisRate: currentBasisRate,
        lastScanAt: snapshot.timestamp,
        lastAlertAt: Date.now(),
        alertCount: (afterSend.alertCount || 0) + 1
      });
    }

    console.log(
      `[ALERT] ${symbol} | ` +
      `Imbalance=${imbalanceTriggered} | ` +
      `Basis=${basisTriggered}`
    );

    return;
  }

  // Không cảnh báo: chỉ cập nhật số liệu gần nhất.
  // Không thay đổi baseline đã có.
  const latest = getCoin(symbol);

  if (
    !latest ||
    latest.paused ||
    latest.baseline !== record.baseline ||
    latest.basisBaseline !== record.basisBaseline
  ) {
    return;
  }

  const changes = {
    lastScanAt: Date.now()
  };

  if (snapshot) {
    changes.lastImbalance = snapshot.imbalance;
  }

  if (currentBasisRate != null) {
    changes.lastBasisRate = currentBasisRate;

    // Coin được thêm từ phiên bản cũ chưa có
    // basisBaseline: lấy giá trị đầu tiên làm mốc.
    if (basisBaseline == null) {
      changes.basisBaseline = currentBasisRate;
    }
  }

  updateCoin(symbol, changes);
}

export async function scanAll() {
  if (scanning) {
    console.log("[MONITOR] Bỏ qua chu kỳ quét chồng");
    return;
  }

  scanning = true;

  try {
    const coins = getCoins().filter(x => !x.paused);

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

export function startMonitor(sendMessage) {
  if (timer) return;

  sendAlert = sendMessage;

  const intervalMs =
    config.intervalMinutes * 60 * 1000;

  timer = setInterval(() => {
    scanAll().catch(error => {
      console.error("[MONITOR ERROR]", errorText(error));
    });
  }, intervalMs);

  console.log(
    `[MONITOR] Every ${config.intervalMinutes} minutes`
  );
  console.log(
    `[MONITOR] Imbalance > ${config.threshold} pp`
  );
  console.log(
    `[MONITOR] Basis Rate >= ${config.basisThreshold} pp`
  );
  console.log("[MONITOR] Alert logic: OR");
}

export function stopMonitor() {
  if (timer) clearInterval(timer);
  timer = null;
}
