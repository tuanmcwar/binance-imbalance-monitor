
import "dotenv/config";

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} không hợp lệ`);
  }

  return value;
}

const depthLimit = positiveNumber("DEPTH_LIMIT", 1000);

if (![5, 10, 20, 50, 100, 500, 1000].includes(depthLimit)) {
  throw new Error("DEPTH_LIMIT không được Binance hỗ trợ");
}

export const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: String(process.env.TELEGRAM_CHAT_ID || ""),

  binanceRest:
    process.env.BINANCE_REST || "https://fapi.binance.com",

  depthLimit,
  rangePercent: positiveNumber("ORDER_BOOK_RANGE_PERCENT", 20),
  intervalMinutes: positiveNumber("SCAN_INTERVAL_MINUTES", 5),
  threshold: positiveNumber("IMBALANCE_THRESHOLD", 10),
  timeout: positiveNumber("REQUEST_TIMEOUT_MS", 15000),
  basisThreshold: positiveNumber("BASIS_THRESHOLD", 1.5),
};

if (!config.telegramToken || !config.telegramChatId) {
  throw new Error(
    "Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID"
  );
}

if (config.rangePercent >= 100 || config.threshold > 200) {
  throw new Error("Phạm vi hoặc ngưỡng cảnh báo không hợp lệ");
}

