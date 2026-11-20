
import "dotenv/config";

// ==========================================
// ENV HELPERS
// ==========================================

function numberEnv(name, fallback, options = {}) {
  const raw = process.env[name];
  const value = Number(
    raw === undefined || raw === "" ? fallback : raw
  );

  const {
    min = -Infinity,
    max = Infinity,
    integer = false
  } = options;

  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${name} không hợp lệ: ${raw ?? fallback}`
    );
  }

  return value;
}

function stringEnv(name, fallback) {
  return String(process.env[name] ?? fallback).trim();
}

// ==========================================
// CONFIG
// ==========================================

const depthLimit = numberEnv("DEPTH_LIMIT", 1000, {
  integer: true
});

if (![5, 10, 20, 50, 100, 500, 1000].includes(depthLimit)) {
  throw new Error(
    "DEPTH_LIMIT không được Binance hỗ trợ"
  );
}

const basisAlertMin = numberEnv(
  "BASIS_ALERT_MIN",
  -1.99
);

const basisAlertMax = numberEnv(
  "BASIS_ALERT_MAX",
  0
);

if (basisAlertMin > basisAlertMax) {
  throw new Error(
    "BASIS_ALERT_MIN phải nhỏ hơn hoặc bằng BASIS_ALERT_MAX"
  );
}

export const config = {
  // ========================================
  // TELEGRAM
  // ========================================

  
  // ========================================
  // TELEGRAM
  // ========================================

  telegramToken: stringEnv(
    "TELEGRAM_BOT_TOKEN",
    ""
  ),

  telegramChatId: stringEnv(
    "TELEGRAM_CHAT_ID",
    ""
  ),

  // Bật/tắt tin nhắn cảnh báo dạng văn bản
  sendAlertText: stringEnv(
    "SEND_ALERT_TEXT",
    "true"
  ).toLowerCase() === "true",


  // ========================================
  // BINANCE
  // ========================================

  binanceRest: stringEnv(
    "BINANCE_REST",
    "https://fapi.binance.com"
  ),

  timeout: numberEnv(
    "REQUEST_TIMEOUT_MS",
    15000,
    { min: 1000 }
  ),

  // ========================================
  // ORDER BOOK
  // ========================================

  depthLimit,

  rangePercent: numberEnv(
    "ORDER_BOOK_RANGE_PERCENT",
    10,
    { min: 0.01, max: 99.99 }
  ),

  // ========================================
  // SCANNER
  // ========================================

  intervalMinutes: numberEnv(
    "SCAN_INTERVAL_MINUTES",
    15,
    { min: 1, max: 1440, integer: true }
  ),

  scanOffsetMinutes: numberEnv(
    "SCAN_OFFSET_MINUTES",
    7,
    { min: 0, max: 1439, integer: true }
  ),

  // ========================================
  // IMBALANCE
  // ========================================

  threshold: numberEnv(
    "IMBALANCE_THRESHOLD",
    10,
    { min: -1000, max: 200 }
  ),

  // ========================================
  // BASIS RATE
  // ========================================

  basisThreshold: numberEnv(
    "BASIS_THRESHOLD",
    1.5,
    { min: 0 }
  ),

  basisAlertMin,
  basisAlertMax,

  // ========================================
  // PRICE PUMP
  // ========================================

  priceThreshold: numberEnv(
    "PRICE_THRESHOLD",
    10,
    { min: -1000, max: 1000 }
  ),

  // ========================================
  // CHART
  // ========================================

  chartInterval: stringEnv(
    "CHART_INTERVAL",
    "15m"
  ),

  chartCandles: numberEnv(
    "CHART_CANDLES",
    20,
    { min: 2, max: 100, integer: true }
  ),

  chartWidth: numberEnv(
    "CHART_WIDTH",
    1400,
    { min: 600, max: 4000, integer: true }
  ),

  chartHeight: numberEnv(
    "CHART_HEIGHT",
    750,
    { min: 400, max: 3000, integer: true }
  )
};

// ==========================================
// VALIDATION
// ==========================================

if (!config.telegramToken || !config.telegramChatId) {
  throw new Error(
    "Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID"
  );
}

// if (
//   config.scanOffsetMinutes >=
//   config.intervalMinutes
// ) {
//   throw new Error(
//     "SCAN_OFFSET_MINUTES phải nhỏ hơn SCAN_INTERVAL_MINUTES"
//   );
// }

const supportedIntervals = [
  "1m", "3m", "5m", "15m", "30m",
  "1h", "2h", "4h", "6h", "8h",
  "12h", "1d"
];

if (!supportedIntervals.includes(config.chartInterval)) {
  throw new Error(
    "CHART_INTERVAL không được hỗ trợ"
  );
}
