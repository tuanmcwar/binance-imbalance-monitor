
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

function formatWall(lines, title, wall) {
  lines.push(title);

  if (!wall) {
    lines.push("Không có Wall trong phạm vi quét");
    return;
  }

  lines.push(`💰 Giá: ${price(wall.price)}`);
  lines.push(`💵 Giá trị: ${money(wall.notional)} USDT`);
  lines.push(
    `📍 Khoảng cách: ${percent(wall.distancePercent)}`
  );
}

export function formatReport(snapshot, basis, options = {}) {
  const lines = [];

  
if (options.alert) {
  const {
    imbalanceTriggered,
    basisTriggered,
    imbalanceChange,
    basisChange,
    imbalanceBaseline,
    basisBaseline
  } = options;

  lines.push("🚨 CẢNH BÁO BINANCE FUTURES");
  lines.push("━━━━━━━━━━━━━━━━━━");

  if (imbalanceTriggered && basisTriggered) {
    lines.push("🔔 Nguyên nhân: IMBALANCE + BASIS RATE");
  } else if (imbalanceTriggered) {
    lines.push("🔔 Nguyên nhân: IMBALANCE");
  } else if (basisTriggered) {
    lines.push("🔔 Nguyên nhân: BASIS RATE");
  }

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
      `Mốc trước: ${percent(basisBaseline)}`
    );
    lines.push(
      `Thay đổi: ${basisChange >= 0 ? "+" : ""}${basisChange.toFixed(2)} điểm %`
    );
    lines.push("");
  }
}


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

  lines.push(
    `📚 ORDER BOOK (±${snapshot.rangePercent}%)`
  );
  lines.push(
    `🟢 BUY Depth: ${money(snapshot.buyTotal)} USDT`
  );
  lines.push(
    `🔴 SELL Depth: ${money(snapshot.sellTotal)} USDT`
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
  lines.push("");

  lines.push("📈 BASIS (REALTIME)");

  if (basis) {
    const basisValue = Number(basis.basis);
    const basisRate = Number(basis.basisRate);
    const futuresPrice = Number(basis.futuresPrice);
    const indexPrice = Number(basis.indexPrice);

    lines.push(`Basis: ${price(basisValue)}`);
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


export function formatStatus(coins, startedAt, scanning) {
  const active = coins.filter(x => !x.paused).length;

  return [
    "🤖 BINANCE IMBALANCE MONITOR V2",
    "━━━━━━━━━━━━━━━━━━",
    "🟢 Bot: ONLINE",
    `📡 Đang quét: ${scanning ? "Có" : "Không"}`,
    `⏱ Chu kỳ: ${config.intervalMinutes} phút`,
    `🚨 Ngưỡng: > ${config.threshold} điểm %`,
    `📚 ORDER BOOK: ±${config.rangePercent}%`,
    `🪙 Tổng coin: ${coins.length}`,
    `🟢 Hoạt động: ${active}`,
    `⏸ Tạm dừng: ${coins.length - active}`,
    `🕒 Khởi động: ${formatTime(startedAt)}`
  ].join("\n");
}

