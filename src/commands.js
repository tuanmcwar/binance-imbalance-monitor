
import { config } from "./config.js";
import { getExchangeInfo, getBasis, errorText } from "./binance.js";
import { fetchSnapshot, fetchFullReport, isScanning } from "./monitor.js";

import {
  getCoin,
  getCoins,
  addCoin,
  removeCoin,
  updateCoin,
  clearCoins
} from "./storage.js";

import {
  formatList,
  formatStatus,
  percent
} from "./formatter.js";

const startedAt = Date.now();

let validSymbols = null;
let validSymbolsLoadedAt = 0;

export function normalizeSymbol(input) {
  const value = String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (!/^[A-Z0-9]{2,30}$/.test(value)) {
    return null;
  }

  return value.endsWith("USDT")
    ? value
    : `${value}USDT`;
}

async function isValidSymbol(symbol) {
  if (
    !validSymbols ||
    Date.now() - validSymbolsLoadedAt > 60 * 60 * 1000
  ) {
    const info = await getExchangeInfo();

    validSymbols = new Set(
      info.symbols
        .filter(x =>
          x.contractType === "PERPETUAL" &&
          x.status === "TRADING" &&
          x.quoteAsset === "USDT" &&
          x.marginAsset === "USDT"
        )
        .map(x => x.symbol)
    );

    validSymbolsLoadedAt = Date.now();
  }

  return validSymbols.has(symbol);
}

export function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "➕ Thêm coin", callback_data: "menu:add" },
        { text: "📋 Danh sách", callback_data: "menu:list" }
      ],
      [
        { text: "➖ Xóa coin", callback_data: "menu:remove" },
        { text: "📊 Trạng thái", callback_data: "menu:status" }
      ],
      [
        { text: "⏸ Tạm dừng", callback_data: "menu:pause" },
        { text: "▶️ Tiếp tục", callback_data: "menu:resume" }
      ],
      [
        { text: "🔍 Kiểm tra", callback_data: "menu:check" },
        { text: "🗑 Xóa tất cả", callback_data: "menu:clear" }
      ]
    ]
  };
}

function coinKeyboard(coins) {
  return {
    inline_keyboard: [
      ...coins.map(coin => [
        {
          text: `${coin.paused ? "▶️" : "⏸"} ${coin.symbol}`,
          callback_data:
            `${coin.paused ? "resume" : "pause"}:${coin.symbol}`
        },
        {
          text: "🔍 Kiểm tra",
          callback_data: `check:${coin.symbol}`
        },
        {
          text: "❌",
          callback_data: `remove:${coin.symbol}`
        }
      ]),
      [{ text: "🏠 Menu", callback_data: "menu:home" }]
    ]
  };
}

export function helpText() {
  return [
    "🤖 BINANCE IMBALANCE MONITOR",
    "━━━━━━━━━━━━━━━━━━",
    "",
    "📌 QUẢN LÝ COIN",
    "/add BTCUSDT - Thêm coin",
    "/remove BTCUSDT - Xóa coin",
    "/list - Danh sách coin",
    "/clear - Xóa toàn bộ",
    "",
    "📊 THEO DÕI",
    "/check BTCUSDT - Kiểm tra ngay",
    "/pause BTCUSDT - Tạm dừng",
    "/resume BTCUSDT - Tiếp tục",
    "/status - Trạng thái bot",
    "/help - Hướng dẫn",
    "",
    "Bạn cũng có thể gửi BTCUSDT để thêm coin.",
    "",
    `⏱ Quét mỗi ${config.intervalMinutes} phút`,
    `📚 ORDER BOOK ±${config.rangePercent}%`,
    `🚨 Imbalance: > ${config.threshold} điểm %`,
    `🚨 Basis Rate: ≥ ${config.basisThreshold} điểm %`,
    `🚀 Price Pump: > ${config.priceThreshold ?? 10}% so với giá khi thêm`,
    "🔀 Logic: OR"
  ].join("\n");
}

export async function addSymbol(symbol) {
  if (getCoin(symbol)) {
    return `⚠️ ${symbol} đã có trong danh sách.`;
  }

  if (!(await isValidSymbol(symbol))) {
    return `❌ ${symbol} không phải USDT Perpetual đang giao dịch.`;
  }

  const [snapshot, basisResult] = await Promise.all([
    fetchSnapshot(symbol),
    getBasis(symbol).catch(error => {
      console.error(`[BASIS] ${symbol}:`, errorText(error));
      return null;
    })
  ]);

  const rawRate = Number(basisResult?.basisRate);
  const basisBaseline =
    basisResult?.basisRate != null &&
    Number.isFinite(rawRate)
      ? rawRate * 100
      : null;

  // Lưu giá Futures tại thời điểm thêm symbol
  const priceBaseline = snapshot.currentPrice;

  if (
    !addCoin(
      symbol,
      snapshot.imbalance,
      basisBaseline,
      priceBaseline
    )
  ) {
    return `⚠️ ${symbol} đã được thêm bởi yêu cầu khác.`;
  }

  return [
    `✅ ĐÃ THÊM ${symbol}`,
    "━━━━━━━━━━━━━━━━━━",
    `🟢 BUY Depth: ${snapshot.buyTotal.toFixed(2)} USDT`,
    `🔴 SELL Depth: ${snapshot.sellTotal.toFixed(2)} USDT`,
    `⚖️ Imbalance mốc: ${percent(snapshot.imbalance)}`,
    `📈 Basis Rate mốc: ${percent(basisBaseline)}`,
    `💰 Giá Futures mốc: ${priceBaseline} USDT`,
    `⏱ Chu kỳ: ${config.intervalMinutes} phút`,
    `🚨 Imbalance: > ${config.threshold} điểm %`,
    `🚨 Basis Rate: ≥ ${config.basisThreshold} điểm %`,
    `🚀 Price Pump: > ${config.priceThreshold ?? 10}%`,
    "🔀 Logic: OR"
  ].join("\n");
}

export function removeSymbol(symbol) {
  return removeCoin(symbol)
    ? `🗑 Đã xóa ${symbol} khỏi danh sách.`
    : `⚠️ ${symbol} chưa được theo dõi.`;
}

export function pauseSymbol(symbol) {
  const coin = getCoin(symbol);

  if (!coin) return `⚠️ ${symbol} chưa được theo dõi.`;
  if (coin.paused) return `⏸ ${symbol} đã tạm dừng.`;

  updateCoin(symbol, { paused: true });

  return `⏸ Đã tạm dừng theo dõi ${symbol}.`;
}

export async function resumeSymbol(symbol) {
  const coin = getCoin(symbol);

  if (!coin) return `⚠️ ${symbol} chưa được theo dõi.`;

  if (!coin.paused) {
    return `🟢 ${symbol} đang hoạt động.`;
  }

  const [snapshot, basis] = await Promise.all([
    fetchSnapshot(symbol),
    getBasis(symbol).catch(error => {
      console.error(`[BASIS] ${symbol}:`, errorText(error));
      return null;
    })
  ]);

  const rawRate = Number(basis?.basisRate);
  const basisBaseline =
    basis?.basisRate != null && Number.isFinite(rawRate)
      ? rawRate * 100
      : null;

  const latest = getCoin(symbol);

  if (!latest || !latest.paused) {
    return `⚠️ Trạng thái ${symbol} đã thay đổi.`;
  }

  updateCoin(symbol, {
    paused: false,
    baseline: snapshot.imbalance,
    basisBaseline,
    // Giữ nguyên priceBaseline khi tiếp tục
    lastPrice: snapshot.currentPrice,
    lastImbalance: snapshot.imbalance,
    lastBasisRate: basisBaseline,
    lastScanAt: snapshot.timestamp
  });

  return [
    `▶️ ĐÃ TIẾP TỤC ${symbol}`,
    `⚖️ Imbalance mốc: ${percent(snapshot.imbalance)}`,
    `📈 Basis Rate mốc: ${percent(basisBaseline)}`,
    `💰 Giá Futures gốc: ${latest.priceBaseline ?? "Chưa có"} USDT`
  ].join("\n");
}

export async function checkSymbol(symbol) {
  if (!(await isValidSymbol(symbol))) {
    return `❌ ${symbol} không hợp lệ hoặc chưa giao dịch.`;
  }

  // /check không thay đổi mốc theo dõi.
  return fetchFullReport(symbol);
}

export function listResult() {
  const coins = getCoins();

  return {
    text: formatList(coins),
    reply_markup: coins.length
      ? coinKeyboard(coins)
      : mainKeyboard()
  };
}

export function statusResult() {
  return {
    text: formatStatus(
      getCoins(),
      startedAt,
      isScanning()
    ),
    reply_markup: mainKeyboard()
  };
}

export function clearResult() {
  const count = clearCoins();

  return `🗑 Đã xóa ${count} coin khỏi danh sách theo dõi.`;
}

export function clearConfirmation() {
  return {
    text: "⚠️ Bạn có chắc muốn xóa toàn bộ coin đang theo dõi?",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🗑 Xác nhận xóa",
            callback_data: "clear:yes"
          },
          {
            text: "❎ Hủy",
            callback_data: "menu:home"
          }
        ]
      ]
    }
  };
}

export function menuResult(action) {
  const messages = {
    add: "➕ Gửi lệnh /add BTCUSDT hoặc gửi trực tiếp BTCUSDT.",
    remove: "➖ Gửi /remove BTCUSDT hoặc chọn ❌ trong /list.",
    pause: "⏸ Gửi /pause BTCUSDT hoặc chọn coin trong /list.",
    resume: "▶️ Gửi /resume BTCUSDT hoặc chọn coin trong /list.",
    check: "🔍 Gửi /check BTCUSDT để xem báo cáo ngay."
  };

  return {
    text: messages[action] || helpText(),
    reply_markup: mainKeyboard()
  };
}

export function handleError(error) {
  console.error("[COMMAND ERROR]", errorText(error));

  return `❌ Lỗi: ${errorText(error)}`;
}
