
import {
  chartFrame, toPng, text, fmt, vnTime
} from "./chartUtils.js";

export async function createImbalanceChart(snapshot) {
  const buy = Number(snapshot.buyTotal);
  const sell = Number(snapshot.sellTotal);
  const imbalance = Number(snapshot.imbalance);

  if (
    !Number.isFinite(buy) ||
    !Number.isFinite(sell) ||
    !Number.isFinite(imbalance)
  ) {
    throw new Error("Dữ liệu Order Book không hợp lệ");
  }

  const max = Math.max(buy, sell, 1);
  const barWidth = 750;

  const buyWidth = buy / max * barWidth;
  const sellWidth = sell / max * barWidth;

  const buyWall = snapshot.buyWall;
  const sellWall = snapshot.sellWall;

  const content = `
    ${text(55, 160, `Imbalance: ${fmt(imbalance)}%`,
      30, imbalance >= 0 ? "#4ade80" : "#f87171")}
    ${text(55, 215, `ORDER BOOK ±${snapshot.rangePercent}%`,
      19, "#94a3b8")}

    ${text(55, 270, "BUY DEPTH", 20, "#4ade80")}
    <rect x="250" y="238" width="${barWidth}" height="42"
      rx="8" fill="#26354e"/>
    <rect x="250" y="238" width="${buyWidth}" height="42"
      rx="8" fill="#16a34a"/>
    ${text(250, 306, `${Math.round(buy).toLocaleString("en-US")} USDT`,
      19)}

    ${text(55, 365, "SELL DEPTH", 20, "#f87171")}
    <rect x="250" y="333" width="${barWidth}" height="42"
      rx="8" fill="#26354e"/>
    <rect x="250" y="333" width="${sellWidth}" height="42"
      rx="8" fill="#dc2626"/>
    ${text(250, 401, `${Math.round(sell).toLocaleString("en-US")} USDT`,
      19)}

    ${text(55, 462, "BUY WALL", 19, "#4ade80")}
    ${text(250, 462,
      buyWall
        ? `${fmt(buyWall.price, 8)} | ${Math.round(buyWall.notional).toLocaleString("en-US")} USDT`
        : "N/A",
      18)}

    ${text(55, 503, "SELL WALL", 19, "#f87171")}
    ${text(250, 503,
      sellWall
        ? `${fmt(sellWall.price, 8)} | ${Math.round(sellWall.notional).toLocaleString("en-US")} USDT`
        : "N/A",
      18)}

    ${text(55, 553,
      `Scan: ${vnTime(snapshot.timestamp)} | Levels: ${snapshot.bidLevels}/${snapshot.askLevels}`,
      16, "#94a3b8")}
  `;

  return toPng(chartFrame(
    `${snapshot.symbol} | ORDER BOOK IMBALANCE`,
    "Realtime snapshot | BUY vs SELL Depth",
    content
  ));
}
