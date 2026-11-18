
import { config } from "./config.js";

export function money(value) {
  if (!Number.isFinite(value)) return "N/A";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

export function price(value) {
  return Number.isFinite(value)
    ? value.toFixed(8)
    : "N/A";
}

export function percent(value) {
  return Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : "N/A";
}

export function formatTime(timestamp) {
  if (!timestamp) return "N/A";

  return new Date(timestamp).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false
  });
}

// ==========================================
// WALL FORMAT
// ==========================================

function formatWall(lines, title, wall) {
  lines.push(title);

  if (!wall) {
    lines.push("Không có Wall trong phạm vi quét");
    return;
  }

  lines.push(`💰 Giá: ${price(wall.price)}`);

  lines.push(
    `💵 Giá trị: ${Math.round(wall.notional).toLocaleString("en-US")} USDT | 📍 Khoảng cách: ${percent(wall.distancePercent)}`
  );
}

// ==========================================
// MARKET REPORT
// ==========================================

export function formatReport(snapshot, basis, options = {}) {
  const lines = [];

  // ==========================================
  // ALERT HEADER
  // ==========================================

  if (options.alert) {
    const {
      imbalanceTriggered,
      basisTriggered,
      priceTriggered,
      imbalanceChange,
      basisChange,
      priceChange,
      imbalanceBaseline,
      basisBaseline
    } = options;

    lines.push("🚨 CẢNH BÁO BINANCE FUTURES");
    lines.push("━━━━━━━━━━━━━━━━━━");

    const reasons = [];

    if (imbalanceTriggered) reasons.push("IMBALANCE");
    if (basisTriggered) reasons.push("BASIS RATE");
    if (priceTriggered) reasons.push("PRICE PUMP");

    lines.push(`🔔 Nguyên nhân: ${reasons.join(" + ")}`);
    lines.push("");

    if (imbalanceTriggered) {
      lines.push("⚖️ IMBALANCE TRIGGER");
      lines.push(
        `Mốc trước: ${percent(imbalanceBaseline)}`
      );
      lines.push(
        `Thay đổi: ${imbalanceChange >= 0 ? "+" : ""}${imbalanceChange.toFixed(2)} điểm %`
      );
      lines.push("");
    }

    if (basisTriggered) {
      lines.push("📈 BASIS RATE TRIGGER");
      lines.push(
        `Mốc trước: ${percent(basisBaseline)} || Thay đổi: ${basisChange >= 0 ? "+" : ""}${basisChange.toFixed(2)} điểm %`
      );
      lines.push("");
    }

    if (priceTriggered) {
      lines.push("🚀 PRICE PUMP TRIGGER");
      lines.push(
        `📈 Tăng giá: +${priceChange.toFixed(2)}%`
      );
      lines.push("");
    }
  }

  // ==========================================
  // MARKET FLOW
  // ==========================================

  lines.push("📊 BINANCE FUTURES MARKET FLOW");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(`🪙 COIN: ${snapshot.symbol}`);
  lines.push(
    `🕒 Thời điểm quét: ${formatTime(snapshot.timestamp)}`
  );
  lines.push("");

  lines.push("💰 GIÁ FUTURES HIỆN TẠI");
  lines.push(`Giá: ${price(snapshot.currentPrice)} USDT`);
  lines.push("");

  // ==========================================
  // ORDER BOOK
  // ==========================================

  lines.push(
    `📚 ORDER BOOK (±${snapshot.rangePercent}%)`
  );

  lines.push(
    `🟢 BUY: ${Math.round(snapshot.buyTotal).toLocaleString("en-US")} USDT | 🔴 SELL: ${Math.round(snapshot.sellTotal).toLocaleString("en-US")} USDT`
  );

  lines.push(
    `⚖️ Imbalance: ${percent(snapshot.imbalance)}`
  );

  lines.push("");

  formatWall(lines, "🟢 BUY WALL", snapshot.buyWall);
  lines.push("");

  formatWall(lines, "🔴 SELL WALL", snapshot.sellWall);
  lines.push("");

  lines.push(
    `📚 Số mức BUY/SELL trong ±${snapshot.rangePercent}%: ` +
    `${snapshot.bidLevels}/${snapshot.askLevels}`
  );

  // ==========================================
  // FUNDING RATE
  // ==========================================

  const fundingRate =
    basis?.fundingRate == null
      ? NaN
      : Number(basis.fundingRate);

  const fundingText = Number.isFinite(fundingRate)
    ? `${fundingRate >= 0 ? "+" : ""}${(fundingRate * 100).toFixed(4)}%`
    : "N/A";

  lines.push(`💸 Funding Rate: ${fundingText}`);

  lines.push("");

  // ==========================================
  // BASIS
  // ==========================================

  lines.push("📈 BASIS (REALTIME)");

  if (basis) {
    const basisRate = Number(basis.basisRate);
    const futuresPrice = Number(basis.futuresPrice);
    const indexPrice = Number(basis.indexPrice);

    lines.push(
      `Basis Rate: ${percent(basisRate * 100)}`
    );

    lines.push(
      `Futures Price: ${price(futuresPrice)}`
    );

    lines.push(
      `Index Price: ${price(indexPrice)}`
    );

    lines.push(
      `Thời điểm lấy Basis: ${formatTime(basis.timestamp)}`
    );
  } else {
    lines.push("Không có dữ liệu Basis");
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(
    "ℹ️ Dữ liệu thị trường, không phải tín hiệu đặt lệnh."
  );

  return lines.join("\n");
}

// ==========================================
// COIN LIST
// ==========================================

export function formatList(coins) {
  if (!coins.length) {
    return "📭 Chưa có coin nào trong danh sách theo dõi.";
  }

  const active = coins.filter(x => !x.paused).length;

  const lines = [
    "📋 DANH SÁCH COIN THEO DÕI",
    "━━━━━━━━━━━━━━━━━━",
    `🪙 Tổng số: ${coins.length}`,
    `🟢 Đang chạy: ${active}`,
    `⏸ Tạm dừng: ${coins.length - active}`,
    ""
  ];

  for (const coin of coins) {
    lines.push(
      `${coin.paused ? "⏸" : "🟢"} ${coin.symbol}`
    );

    lines.push(
      `   ⚖️ Mốc Imbalance: ${percent(coin.baseline)}`
    );

    lines.push(
      `   📈 Mốc Basis Rate: ${percent(
        coin.basisBaseline == null
          ? NaN
          : Number(coin.basisBaseline)
      )}`
    );

    const baselinePrice =
      coin.priceBaseline == null
        ? NaN
        : Number(coin.priceBaseline);

    const lastPrice =
      coin.lastPrice == null
        ? NaN
        : Number(coin.lastPrice);

    lines.push(
      `   💰 Giá Futures gốc: ${price(baselinePrice)} USDT`
    );

    lines.push(
      `   💰 Giá gần nhất: ${price(lastPrice)} USDT`
    );

    if (
      Number.isFinite(baselinePrice) &&
      baselinePrice > 0 &&
      Number.isFinite(lastPrice)
    ) {
      const change =
        ((lastPrice - baselinePrice) / baselinePrice) * 100;

      lines.push(
        `   🚀 Biến động giá: ${change >= 0 ? "+" : ""}${percent(change)}`
      );
    }

    lines.push(
      `   🕒 Lần quét: ${formatTime(coin.lastScanAt)}`
    );

    lines.push(
      `   🚨 Cảnh báo: ${coin.alertCount || 0}`
    );

    lines.push("");
  }

  return lines.join("\n");
}

// ==========================================
// STATUS
// ==========================================

export function formatStatus(coins, startedAt, scanning) {
  const active = coins.filter(x => !x.paused).length;

  return [
    "🤖 BINANCE IMBALANCE MONITOR V2",
    "━━━━━━━━━━━━━━━━━━",
    "🟢 Bot: ONLINE",
    `📡 Đang quét: ${scanning ? "Có" : "Không"}`,
    "⏱ Lịch quét: phút 14, 29, 44, 59",
    `🚨 Imbalance: > ${config.threshold} điểm %`,
    `🚨 Basis Rate: ≥ ${config.basisThreshold} điểm %`,
    `🚀 Price Pump: > ${config.priceThreshold ?? 10}%`,
    "🔀 Logic: OR",
    `📚 ORDER BOOK: ±${config.rangePercent}%`,
    `🪙 Tổng coin: ${coins.length}`,
    `🟢 Hoạt động: ${active}`,
    `⏸ Tạm dừng: ${coins.length - active}`,
    `🕒 Khởi động: ${formatTime(startedAt)}`
  ].join("\n");
}
